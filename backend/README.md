# Trilha — Backend (FastAPI)

API que preenche o contrato que o frontend já consome (`src/lib/api.ts` e `src/lib/types.ts`).

## Estado atual (passo 3)

O backend funciona em **dois modos**, escolhidos pela variável `DATABASE_URL`:

- **Sem `DATABASE_URL`** → estado em memória (`app/estado.py`), que espelha o mock do
  frontend. Reinicia do zero a cada restart. É o modo do passo 1.
- **Com `DATABASE_URL`** → persistência no **Postgres do Supabase** (`app/repo.py`). Os
  dados (alunos, PINs, status, histórico, config da turma) sobrevivem a restart.

O diagnóstico de dificuldade usa um **modelo de ML** (passo 3, ver abaixo). Os dois modos
expõem os mesmos endpoints; o `main.py` e o frontend não mudam.
Ainda **não** tem: LLM real no chat/recomendações — próximo passo.

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
| POST | `/turmas/{id}/chat` | Chat da turma para o professor (placeholder até o LLM) |

## Estrutura

```
app/
  main.py        rotas FastAPI + CORS; escolhe estado (memória) ou repo (banco)
  esquemas.py    corpos de requisição (Pydantic)
  estado.py      estado em memória + regras (modo sem banco)
  repo.py        mesma interface, lendo/gravando no Postgres (modo com banco)
  bd.py          conexão com o Postgres (lê DATABASE_URL do .env)
  modelos.py     tabelas SQLAlchemy
  seed.py        cria as tabelas e popula a demo (python -m app.seed)
  dados.py       seed: turma, habilidades, alunos, PINs, banco de perguntas
  adaptacao.py   dificuldade adaptativa (mesma regra do frontend)
  chat.py        placeholder do chat (vira LLM depois)
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
