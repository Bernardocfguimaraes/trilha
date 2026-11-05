# Trilha — Backend (FastAPI)

API que preenche o contrato que o frontend já consome (`src/lib/api.ts` e `src/lib/types.ts`).

## Estado atual (passo 3)

O backend funciona em **três modos**, escolhidos pela variável `DATABASE_URL`:

- **`sqlite:///trilha.db`** → persistência num **arquivo local** (`backend/trilha.db`), sem
  servidor e sem internet. É o modo recomendado para apresentar (ver abaixo).
- **`postgresql://...`** → persistência no **Postgres do Supabase**.
- **Sem `DATABASE_URL`** → estado em memória (`app/estado.py`), que espelha o mock do
  frontend. Reinicia do zero a cada restart. É o modo do passo 1.

Nos dois modos com banco o código é o mesmo (`app/repo.py`): alunos, PINs, status,
histórico e configuração da turma sobrevivem a restart.

O diagnóstico de dificuldade usa um **modelo de ML** (passo 3, ver abaixo). Os dois modos
expõem os mesmos endpoints; o `main.py` e o frontend não mudam.
Ainda **não** tem: LLM real no chat/recomendações — próximo passo.

## Acesso e segurança

| Quem | Como entra | O que pode |
|---|---|---|
| Professor | e-mail + senha → token assinado (12 h) | tudo do painel: alunos, PINs, configuração, chat, voz, exercícios |
| Aluno | código da turma + PIN → credencial (8 h) | abrir e responder as próprias sessões |
| Responsável | código da turma + PIN do filho → mesma credencial | ler o progresso só daquele aluno |

- **Conta do professor**: vem do `.env` (`PROFESSOR_EMAIL`, `PROFESSOR_SENHA`, `PROFESSOR_NOME`) e
  é gravada no banco ao subir a API, com a senha só em hash PBKDF2. Não há cadastro público: num
  app de uma turma, qualquer conta criada por um estranho veria todos os alunos.
- **`TRILHA_SEGREDO`** assina os tokens. Sem ele, a API gera um segredo temporário e os logins
  caem a cada reinício. Gere com `python -c "import secrets; print(secrets.token_hex(32))"`.
- Bloqueio temporário depois de 5 senhas erradas (por e-mail) e de 5 PINs errados (por aluno).
- Credenciais e ids de sessão são aleatórios; a credencial cai quando o professor troca o PIN.
  Só dá para responder perguntas entregues à própria sessão (nada de "gabarito aberto").
- CORS só para as origens do front (`TRILHA_CORS`), limites de tamanho em todos os corpos,
  áudio de no máximo 8 MB, e cabeçalhos `nosniff`, `X-Frame-Options` e `Cache-Control: no-store`.
- No front, o token fica num cookie httpOnly; o navegador fala com as rotas do professor pela
  ponte `/api/professor/*` do Next, que anexa o token. O site manda CSP e `frame-ancestors 'none'`.

## Apresentar sem depender da rede (SQLite)

Algumas redes (como a da faculdade) bloqueiam a porta do Postgres, e aí o Supabase não
conecta. Com SQLite o banco é um arquivo no próprio notebook:

1. Em `backend/.env`: `DATABASE_URL=sqlite:///trilha.db` (e a linha do Supabase comentada).
2. Suba a API: `uvicorn app.main:app --port 8000`. Se `backend/trilha.db` não existir, ela
   cria as tabelas e popula a demo sozinha. Confira em http://localhost:8000/saude, que
   deve mostrar `"banco": "sqlite"`.
3. Para recomeçar a demo do zero antes de apresentar: `python -m app.seed`.

IA (Groq) e voz continuam usando a internet normalmente. O arquivo `trilha.db` não vai
para o git. Dá para abrir as tabelas com o [DB Browser for SQLite](https://sqlitebrowser.org/)
para mostrar o banco.

## Passo 2 — Ligar o Supabase

1. Crie um projeto em supabase.com (New project), defina a senha do banco e a região.
2. Copie a connection string: **Settings → Database → Connection string → URI**.
3. Em `backend/`, copie `.env.example` para `.env` e cole a string em `DATABASE_URL`
   (troque `[YOUR-PASSWORD]` pela senha do banco). O `.env` não vai para o git.
4. Crie as tabelas e popule a demo:
   ```bash
   python -m app.seed
   ```
   (Idempotente: derruba e recria as tabelas. Rode de novo para resetar a demo.)
5. Suba a API normalmente (`uvicorn app.main:app --reload --port 8000`). Agora os dados
   são lidos e gravados no Supabase.

Para voltar ao modo em memória, basta esvaziar/comentar `DATABASE_URL` no `.env`.

## Passo 3 — Diagnóstico com ML

O status de cada habilidade (ok / atenção / alerta) deixou de ser uma regra de limiar e
passou a vir de um **modelo de Machine Learning** (Random Forest) que olha a trajetória do
aluno naquela habilidade: média, média recente, tendência (está melhorando ou piorando),
consistência, pior dia e volume de dados.

**Como foi treinado (caminho A — dados sintéticos).** Não existe base real de alunos ainda,
então o dataset é simulado de forma realista (`ml/gerar_dados.py`): cada aluno-habilidade
tem uma proficiência e uma tendência latentes, geramos uma série de desempenho com ruído e
rotulamos pela situação "efetiva" (nível + peso forte da tendência). Isso torna o problema
genuinamente de ML: a regra de limiar na média não enxerga a tendência, o modelo sim.

**Resultado (ml/relatorio_treino.txt):** Random Forest **0.755** de acurácia no teste contra
**0.659** da regra de limiar — **+9,6 pontos**. As features mais importantes são a média
recente e a **tendência**. A classe "atenção" (o meio-termo) é a mais difícil, como esperado.

**Treino x produção.** O treino usa scikit-learn e roda com:
```bash
pip install -r ml/requirements-treino.txt
python -m ml.gerar_dados     # gera ml/dados_sinteticos.csv
python -m ml.treinar         # treina, avalia e exporta app/modelo_diagnostico.json
```
O **backend em produção não usa scikit-learn**: o modelo é exportado para
`app/modelo_diagnostico.json` e a inferência roda em Python puro (`app/diagnostico.py`),
com previsões idênticas às do scikit-learn (paridade verificada = 100%). Se o JSON faltar,
o diagnóstico cai na regra de limiar antiga — nada quebra.

O endpoint `POST /diagnostico/reavaliar` re-roda o modelo sobre o histórico de toda a turma
(útil para demonstrar o ML classificando a turma de uma vez).

## Passo 4 — LLM nas recomendações e no chat

Dois pontos deixaram de usar texto pronto e passaram a ser gerados por um LLM:

- **Recomendações** (`app/recomendacoes.py`) — o texto pedagógico que aparece quando um
  aluno está em alerta/atenção. Só gera para quem está em alerta/atenção e **cacheia por
  (habilidade, status)** — é o controle de custo que o professor pediu (não chama o LLM à toa).
- **Chat da turma** (`app/chat.py`, `responder_llm`) — vira conversa de verdade: o LLM recebe
  um retrato real da turma (quem está em alerta/atenção, evolução, quem sumiu) e o histórico
  da conversa. Sem LLM, cai no responder por palavra-chave.

**Funciona com ou sem LLM.** Sem `LLM_API_KEY`, tudo usa os textos prontos (fallback) e nada
quebra. Com a chave, gera de verdade. Qualquer erro (cota, rede, timeout) também cai no fallback.

**Configurar (grátis).** Crie uma chave no Groq (https://console.groq.com → API Keys) e no
`.env` do backend:
```
LLM_API_KEY=coloque_a_chave_aqui
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b
LLM_REVISOR_MODEL=qwen/qwen3.8-27b
```
O cliente (`app/llm.py`) fala com qualquer provedor compatível com a API da OpenAI — para usar
Gemini/Together/outro, basta trocar `LLM_BASE_URL` e `LLM_MODEL`. Nenhuma dependência nova:
a chamada usa a biblioteca padrão. Confira o nome do modelo atual na lista do provedor.

**Cota gratuita.** Na Groq o limite grátis é por modelo. Por isso o revisor das questões geradas
(`LLM_REVISOR_MODEL`) roda em outro modelo: tem cota própria e, sendo de outra família, erra de
forma diferente do gerador. Dá para somar um provedor de reserva também grátis (`LLM_RESERVA_*`,
ex.: Gemini do Google AI Studio, sem cartão), usado quando a cota do dia acaba. As questões dos
caminhos BNCC são geradas em lote e versionadas (`python -m app.bncc.gerar_perguntas 4 por`):
quando a cota acaba o lote para sozinho e, rodando de novo no dia seguinte, continua de onde parou.
O app ao vivo não gasta cota com isso.

## Rodar local

Precisa de Python 3.11+.

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Abra http://localhost:8000/docs para ver e testar todos os endpoints (Swagger).

## Ligar o frontend a este backend

Por padrão, o frontend usa o mock interno dele. Para ele falar com esta API, crie
`.env.local` na raiz do frontend com:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

e reinicie o `next dev`. Sem essa variável, nada muda — o mock continua valendo.

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| POST | `/auth/entrar` | Login do professor (e-mail + senha) → token |
| GET | `/auth/eu` | Professor do token (confere o login) |
| GET | `/alunos` | Lista de alunos com status por habilidade |
| GET | `/alunos/{id}` | Detalhe do aluno + recomendações |
| GET | `/alunos/{id}/historico` | Evolução por habilidade ao longo do tempo |
| GET | `/turma/configuracao` | Disciplinas e habilidades ativas no ciclo |
| PUT | `/turma/configuracao` | Salva disciplinas/habilidades ativas |
| GET | `/turma/alunos` | Cadastro dos alunos com PIN (visão do professor) |
| POST | `/turma/alunos/{id}/pin` | Gera um novo PIN para o aluno |
| POST | `/diagnostico/reavaliar` | Re-roda o diagnóstico de ML sobre toda a turma |
| GET | `/turmas/{codigo}` | Dados públicos da turma (lista de nomes, disciplinas) |
| POST | `/acesso/pin` | Valida o PIN do aluno e devolve a credencial de acesso |
| POST | `/sessoes` | Inicia uma sessão de atividades (exige a credencial) |
| POST | `/sessoes/{id}/respostas` | Registra a resposta e devolve a próxima pergunta (adaptativa) |
| POST | `/sessoes/{id}/concluir` | Fecha a sessão e grava no histórico |
| POST | `/turmas/{id}/chat` | Chat da turma para o professor (LLM) |
| POST | `/exercicios/gerar` | Exercício de reforço para uma habilidade |
| POST | `/voz/transcrever` | Transcrição de áudio (Whisper) |
| POST | `/responsavel/progresso` | Progresso só do aluno dono da credencial do PIN |

As rotas do painel (de `/auth/eu` a `/voz/transcrever`, exceto as do aluno e do responsável)
exigem `Authorization: Bearer <token>`.

## Estrutura

```
app/
  main.py        rotas FastAPI + CORS; escolhe estado (memória) ou repo (banco)
  esquemas.py    corpos de requisição (Pydantic)
  estado.py      estado em memória + regras (modo sem banco)
  repo.py        mesma interface, lendo/gravando no banco (SQLite ou Postgres)
  bd.py          conexão com o banco, SQLite ou Postgres (lê DATABASE_URL do .env)
  modelos.py     tabelas SQLAlchemy
  seed.py        cria as tabelas e popula a demo (python -m app.seed; no SQLite também roda sozinho)
  dados.py       seed: turma, habilidades, alunos, PINs, banco de perguntas
  adaptacao.py   dificuldade adaptativa (mesma regra do frontend)
  chat.py        chat da turma: caminho LLM + fallback por palavra-chave
  llm.py         cliente de LLM (compatível com OpenAI; stdlib; fallback gracioso)
  recomendacoes.py  texto de recomendação via LLM, com cache e fallback
  diag_features.py  features do diagnóstico (stdlib; treino e inferência usam a mesma)
  diagnostico.py    inferência do ML em Python puro (lê modelo_diagnostico.json; fallback regra)
  modelo_diagnostico.json  Random Forest exportado (gerado por ml/treinar.py)
ml/
  gerar_dados.py          gera o dataset sintético (caminho A)
  treinar.py              treina, avalia e exporta o modelo (scikit-learn)
  requirements-treino.txt dependências só do treino (não do backend)
  dados_sinteticos.csv    dataset gerado
  relatorio_treino.txt    métricas da última execução do treino
```
