# Trilha — Backend (FastAPI)

API que preenche o contrato que o frontend já consome (`src/lib/api.ts` e `src/lib/types.ts`).

## Estado atual (passo 1)

Todos os endpoints respondem contra um **estado em memória** (`app/estado.py`) que espelha,
regra por regra, o mock do frontend. Isso prova a integração ponta a ponta antes de ligar o
banco real. Ainda **não** tem: persistência (Supabase), diagnóstico com ML clássico e
LLM real no chat/recomendações — esses são os próximos passos.

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
| GET | `/turmas/{codigo}` | Dados públicos da turma (lista de nomes, disciplinas) |
| POST | `/acesso/pin` | Valida o PIN do aluno e devolve a credencial de acesso |
| POST | `/sessoes` | Inicia uma sessão de atividades (exige a credencial) |
| POST | `/sessoes/{id}/respostas` | Registra a resposta e devolve a próxima pergunta (adaptativa) |
| POST | `/sessoes/{id}/concluir` | Fecha a sessão e grava no histórico |
| POST | `/turmas/{id}/chat` | Chat da turma para o professor (placeholder até o LLM) |

## Estrutura

```
app/
  main.py        rotas FastAPI + CORS
  esquemas.py    corpos de requisição (Pydantic)
  estado.py      estado em memória + regras (vira Supabase depois)
  dados.py       seed: turma, habilidades, alunos, PINs, banco de perguntas
  adaptacao.py   dificuldade adaptativa (mesma regra do frontend)
  chat.py        placeholder do chat (vira LLM depois)
```
