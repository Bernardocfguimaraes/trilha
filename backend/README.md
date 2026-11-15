# Trilha — API (FastAPI)

API da Trilha: turmas, alunos, sessões de atividades com dificuldade adaptativa, diagnóstico
com Machine Learning, previsão de risco, grupos de reforço e recursos de IA (LLM e voz). O
front em Next.js consome o contrato definido em `src/lib/api.ts` e `src/lib/types.ts`.

- [Como rodar](#como-rodar)
- [Configuração](#configuração)
- [Banco de dados](#banco-de-dados)
- [Segurança](#segurança)
- [Machine Learning](#machine-learning)
- [IA com LLMs](#ia-com-llms)
- [Conteúdo BNCC](#conteúdo-bncc)
- [Rotas](#rotas)
- [Testes](#testes)
- [Estrutura](#estrutura)

## Como rodar

Requisito: Python 3.12 ou mais novo.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # preencha o login do professor e TRILHA_SEGREDO
uvicorn app.main:app --reload --port 8000
```

- `http://localhost:8000/saude` mostra se a API está no ar e qual banco está em uso.
- `http://localhost:8000/docs` traz a documentação interativa (Swagger).
- No front, `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` em `.env.local` liga o site a esta API.

## Configuração

Todas as variáveis ficam em `backend/.env` (modelo em `.env.example`; o `.env` não vai para o git).

| Variável | Obrigatória | Para que serve |
|---|:---:|---|
| `DATABASE_URL` | não | `sqlite:///trilha.db` (arquivo local), `postgresql://...` (Supabase) ou vazia (memória) |
| `PROFESSOR_NOME`, `PROFESSOR_EMAIL`, `PROFESSOR_SENHA` | sim | Conta do painel. É gravada no banco ao subir a API, com a senha em hash |
| `TRILHA_SEGREDO` | sim | Assina os logins. Gere com `python -c "import secrets; print(secrets.token_hex(32))"` |
| `TRILHA_CORS` | não | Origens do front autorizadas (padrão: `http://localhost:3000,http://127.0.0.1:3000`) |
| `TRILHA_CORS_REGEX` | não | Padrão de origens aceitas, para deploy (ex.: as prévias do Vercel) |
| `LLM_API_KEY` | não | Chave da Groq. Sem ela, a API usa textos prontos e o banco curado |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_REASONING_EFFORT` | não | Provedor e modelo gerador (padrão: Groq, `openai/gpt-oss-120b`) |
| `LLM_REVISOR_MODEL` | não | Modelo que revisa as questões geradas (padrão do `.env.example`: `qwen/qwen3.8-27b`) |
| `LLM_RESERVA_API_KEY`, `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODEL` | não | Provedor de reserva gratuito (ex.: Gemini), usado quando a cota do dia acaba |

## Banco de dados

O mesmo código (`app/repo.py`, tabelas em `app/modelos.py`) serve aos três modos:

| `DATABASE_URL` | Modo | Quando usar |
|---|---|---|
| `sqlite:///trilha.db` | Arquivo `backend/trilha.db` | Apresentações e uso local: não depende da rede |
| `postgresql://...` | Postgres (Supabase) | Produção com dados que não somem |
| vazia | SQLite em memória | Testes; reinicia do zero a cada restart |

- **SQLite:** se o arquivo não existir, a API cria as tabelas e a demo ao subir. Para recomeçar
  a demo do zero: `python -m app.seed`.
- **Datas da demo:** o histórico é deslocado para terminar no dia em que o banco é criado (a
  última atividade fica em "ontem" ou na semana anterior). Antes de apresentar, rode
  `python -m app.seed` para a demo ficar com datas atuais.
- **Postgres:** crie as tabelas e a demo uma vez com `python -m app.seed` apontando para o banco.
- **Catálogo sempre atualizado:** num banco que já existia, a API acrescenta ao subir as
  habilidades novas do código (por exemplo, um ano de conteúdo novo), sem apagar turmas,
  alunos ou histórico.
- **Demo:** "4º ano B" (código `SABIA4`, 10 alunos com histórico) e "8º ano A" (código
  `TUCANO8`, 6 alunos começando do zero), ambos do professor do `.env`.

## Segurança

| Quem | Como entra | O que pode |
|---|---|---|
| Professor | e-mail + senha → token assinado (12 h) | Tudo do painel, só nas próprias turmas |
| Aluno | código da turma + PIN → credencial (8 h) | Abrir e responder as próprias sessões |
| Responsável | código da turma + PIN do filho → mesma credencial | Ler o progresso só daquele aluno |

- Senha do professor em hash PBKDF2; não há cadastro público.
- Bloqueio temporário depois de 5 senhas erradas (por e-mail) ou 5 PINs errados (por aluno).
- Turma ou aluno de outro professor responde 404.
- Credenciais e ids de sessão aleatórios; gerar um PIN novo derruba a credencial anterior.
- Só dá para responder perguntas entregues à própria sessão; a resposta certa só vai para o
  navegador depois da resposta do aluno, e repetir uma resposta não soma estrela.
- Limites de tamanho em todos os corpos, áudio de no máximo 8 MB, CORS restrito às origens do
  front e cabeçalhos `nosniff`, `X-Frame-Options` e `Cache-Control: no-store`.
- No front, o token fica num cookie httpOnly e as rotas do professor passam pela ponte
  `/api/professor/*` do Next.

## Machine Learning

Os modelos são treinados em `ml/` com scikit-learn e exportados para JSON. A API faz a
inferência em Python puro (`app/diagnostico.py`, `app/risco.py`), com resultado idêntico ao do
scikit-learn (verificado por teste). Sem o arquivo do modelo, o diagnóstico cai na regra de
limiar e nada quebra.

### Dados de treino iguais aos de produção

Não existe base real de alunos, então os dados são simulados: cada aluno-habilidade tem
proficiência e tendência latentes, e a nota de cada dia é gerada com as regras do próprio app
(`ml/simulacao.py`): sessões de 6 perguntas divididas entre 1 e 4 habilidades, pontos fixos
por nível (60/0, 80/20, 100/40) e dificuldade adaptativa. O rótulo vem do nível latente, não
das notas observadas.

A primeira versão usava notas "suaves" (nível + ruído pequeno) e tinha F1 macro 0,71 nesses
dados. Com notas como as do app, caía para 0,51, abaixo da regra simples (0,57). Os dados
passaram a vir do mesmo processo do app, e dois testes impedem que isso volte.

### Diagnóstico (`ml/treinar.py`)

Random Forest sobre nove indicadores da série de cada habilidade (`app/diag_features.py`):
médias geral, recente e inicial, tendência, oscilação, pior dia, dias de atividade e, por
regressão linear sobre todos os dias, o nível estimado hoje e a variação no período.
Hiperparâmetros por GridSearch com validação cruzada estratificada de 5 partes, otimizando F1
macro.

| Modelo (1.000 casos de teste) | F1 macro | Acurácia | "Atenção" encontrados |
|---|:---:|:---:|:---:|
| Regra de limiar (média recente) | 0,567 | 67,6% | 20% |
| Árvore de decisão | 0,540 | 73,4% | 2% |
| Random Forest sem ajuste | 0,561 | 74,7% | 4,5% |
| **Random Forest ajustado (em uso)** | **0,614** | **66,7%** | **51%** |

Validação cruzada: F1 macro 0,618. Os modelos sem ajuste têm acurácia maior porque quase nunca
dizem "atenção"; o modelo em uso encontra 2,5 vezes mais esses alunos. O indicador mais
importante é o nível estimado hoje (39%).

### Previsão de risco (`ml/risco.py`)

Para habilidades que hoje não estão em alerta, estima a chance de o nível nas próximas 3
sessões ficar abaixo de 55. O ponto de corte (0,82) é o menor em que mais da metade dos avisos
se confirma na validação cruzada.

| Medida (teste) | Modelo | Regra simples |
|---|:---:|:---:|
| AUC ROC | **0,90** | — |
| Avisos que se confirmaram | **64%** | 34% |
| Quedas avisadas | **36%** | 28% |

Com 1 ou 2 respostas por dia, a tendência de poucos dias é quase toda ruído (regressão à
média), então a previsão se apoia sobretudo no nível atual estimado.

### Grupos de reforço (`app/grupos.py`)

k-means com inicialização k-means++ sobre a média recente de cada aluno em cada habilidade; o
número de grupos (2 a 4) vem do maior coeficiente de silhueta. Python puro, validado contra o
scikit-learn.

### Retreinar

```bash
pip install -r ml/requirements-treino.txt
python -m ml.gerar_dados        # dataset em ml/dados_sinteticos.csv
python -m ml.treinar            # diagnóstico → app/modelo_diagnostico.json
python -m ml.risco              # previsão → app/modelo_risco.json
python -m ml.exportar_reais     # rótulos das professoras → ml/dados_reais.csv (entra no próximo treino)
```

O pipeline é reproduzível: rodar de novo gera modelos idênticos. Os relatórios ficam em
`ml/relatorio_treino.txt` e `ml/relatorio_risco.txt`. Com dados reais, o treino só implanta o
modelo novo se ele não piorar na validação feita sobre esses casos.

## IA com LLMs

O cliente (`app/llm.py`) fala com qualquer provedor compatível com a API da OpenAI usando só a
biblioteca padrão. Qualquer falha (sem chave, cota, rede) cai em textos prontos.

| Recurso | Módulo | Como funciona |
|---|---|---|
| Exercícios de reforço | `app/exercicios.py` | O gerador cria a questão; um checador em Python confere o formato; um revisor de outro modelo resolve sem ver o gabarito e só aprova se concordar. Se falhar, entra uma questão do banco curado |
| Recomendações | `app/recomendacoes.py` | Texto pedagógico para habilidades em alerta ou atenção, com cache por habilidade e status |
| Conversa sobre a turma | `app/chat.py` | O LLM recebe um retrato da turma (alertas, evolução, quem parou) e o histórico da conversa |
| Voz | `app/voz.py` | Transcrição com Whisper na Groq |

Na Groq o limite gratuito é por modelo; por isso o revisor usa outro modelo, com cota própria.

**Avaliação do revisor** (`python -m ml.avaliar_llm`): 20 questões curadas e as mesmas com o
gabarito trocado, revisadas pelo próprio gerador e pelo outro modelo, mais 12 gerações ao vivo.
Os dois revisores pegaram 100% dos gabaritos trocados sem recusar questão boa; ao vivo, o
revisor de outro modelo foi mais rigoroso (aprovou 7 de 10, contra 8). As respostas ficam em
cache para retomar quando a cota acaba; o resultado vai para `app/avaliacao_llm.json`.

## Conteúdo BNCC

- Atividades do 4º ao 9º ano, nas seis matérias; no 5º são cinco, porque na BNCC a Língua
  Inglesa começa no 6º.
- `app/bncc/oficial_ef.json`: texto oficial de todas as habilidades do Ensino Fundamental.
- `app/bncc/caminhos/AA-disc.json`: habilidades de cada ano e matéria, em ordem.
- `app/bncc/perguntas/AA-disc.json`: questões. A ordem das opções é sorteada na carga.
- Para abrir um ano novo, basta criar os dois arquivos; o ano passa a aparecer sozinho.

Ferramentas de conteúdo (`scripts/`):

```bash
python -m scripts.extrair_bncc bncc.txt          # texto do PDF da BNCC → app/bncc/oficial_ef.json
python -m scripts.gerar_perguntas 4 por          # gera questões em lote com o LLM e o revisor
```

A geração em lote para sozinha quando a cota do dia acaba e continua de onde parou na próxima
execução.

## Rotas

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | Situação da API e banco em uso |
| POST | `/auth/entrar` | Login do professor → token |
| GET | `/auth/eu` | Professor do token |
| GET | `/anos` | Anos com atividades e suas matérias |
| GET · POST | `/turmas` | Lista ou cria turmas (código e PINs gerados) |
| GET · POST | `/turmas/{id}/alunos` | Alunos com status e risco; cadastra aluno |
| GET | `/turmas/{id}/cadastros` | Alunos com PIN |
| GET · PUT | `/turmas/{id}/configuracao` | Matérias e habilidades ativas |
| POST | `/turmas/{id}/diagnostico` | Reavalia a turma com o modelo |
| GET | `/turmas/{id}/grupos` | Grupos de reforço |
| GET | `/turmas/{id}/relatorio.csv` | Planilha da turma |
| POST | `/turmas/{id}/chat` | Conversa sobre a turma |
| GET | `/alunos/{id}` | Detalhe do aluno, recomendações e caminhos |
| GET | `/alunos/{id}/historico` | Evolução por habilidade |
| GET | `/alunos/{id}/diagnostico` | Diagnóstico explicado e previsão de risco |
| PUT | `/alunos/{id}/diagnostico/{habilidade}` | Professora confirma ou corrige o diagnóstico |
| POST | `/alunos/{id}/pin` | Gera um PIN novo |
| GET | `/modelo` | Métricas dos modelos e da avaliação do LLM |
| POST | `/exercicios/gerar` | Exercício de reforço |
| POST | `/voz/transcrever` | Transcrição de áudio |
| GET | `/turmas/{codigo}` | Dados públicos da turma (para o aluno entrar) |
| POST | `/acesso/pin` | Valida o PIN e devolve a credencial |
| POST | `/sessoes` | Abre uma sessão de atividades |
| POST | `/sessoes/{id}/respostas` | Registra a resposta e devolve a próxima pergunta |
| POST | `/sessoes/{id}/concluir` | Fecha a sessão e grava no histórico |
| POST | `/responsavel/progresso` | Progresso do aluno dono da credencial |

As rotas do professor exigem `Authorization: Bearer <token>`.

## Testes

```bash
pip install -r requirements-dev.txt -r ml/requirements-treino.txt
python -m pytest
```

61 testes, com a API inteira em memória (sem rede e sem LLM): segurança, turmas e conteúdo
por ano, qualidade das questões, acesso do responsável, relatórios, revisão dos exercícios gerados por IA e modelos (paridade com o
scikit-learn, métricas acima da regra, simulador igual ao app, k-means). A integração contínua
(`.github/workflows/testes.yml`) roda tudo a cada push.

## Estrutura

```
backend/
├── app/                        API
│   ├── main.py                 rotas, CORS e cabeçalhos de segurança
│   ├── esquemas.py             corpos das requisições (Pydantic, com limites)
│   ├── repo.py                 camada de dados
│   ├── modelos.py              tabelas (SQLAlchemy)
│   ├── bd.py                   conexão com o banco
│   ├── seed.py                 tabelas, demo e sincronização do catálogo
│   ├── dados.py                catálogo por ano, banco de questões e dados da demo
│   ├── catalogo.py             leitura dos caminhos e questões BNCC
│   ├── caminho.py              regras do caminho BNCC (frente, habilidade concluída)
│   ├── regras.py               regras puras: pontuação, escolha de pergunta, PIN
│   ├── adaptacao.py            dificuldade adaptativa (mesma regra do front)
│   ├── seguranca.py            login, hash, token e bloqueio
│   ├── credenciais.py          credenciais do PIN e ids de sessão
│   ├── diag_features.py        indicadores das séries (treino e inferência)
│   ├── diagnostico.py          inferência e explicação do diagnóstico
│   ├── risco.py                inferência da previsão de risco
│   ├── grupos.py               k-means e silhueta
│   ├── llm.py                  cliente de LLM com reserva e fallback
│   ├── exercicios.py           geração e revisão de exercícios
│   ├── recomendacoes.py        recomendações pedagógicas
│   ├── chat.py                 conversa sobre a turma
│   ├── voz.py                  transcrição de áudio
│   ├── modelo_*.json           modelos exportados e suas métricas
│   ├── avaliacao_llm.json      resultado da avaliação do revisor
│   └── bncc/                   texto oficial, caminhos e questões por ano
├── ml/                         treino e avaliação
│   ├── simulacao.py            notas do dia com as regras do app
│   ├── gerar_dados.py          dataset sintético
│   ├── treinar.py              diagnóstico
│   ├── risco.py                previsão de risco
│   ├── avaliar_llm.py          avaliação do revisor de IA
│   ├── exportar_reais.py       rótulos das professoras para o retreino
│   └── relatorio_*.txt         métricas da última execução
├── scripts/                    ferramentas de conteúdo BNCC
├── tests/                      testes da API
├── requirements.txt            dependências da API
├── requirements-dev.txt        dependências dos testes
└── ml/requirements-treino.txt  dependências do treino
```
