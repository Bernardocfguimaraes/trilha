# Deploy da Trilha (Vercel, plano gratuito)

O site e a API ficam num único projeto da Vercel, com **Vercel Services**, e os dados num
Postgres gratuito do **Neon**, criado pela própria Vercel. A IA continua no plano gratuito da
Groq.

```
navegador ──► trilha.vercel.app ─┬─► serviço "site" (Next.js)  ──┐ ligação interna
                                 │                               ▼ (API_INTERNAL_URL)
                                 └─► /backend/* ──► serviço "api" (FastAPI) ──► Neon (Postgres)
```

- O painel do professor fala com a API pelo servidor do Next, por uma ligação interna entre os
  serviços; o token fica num cookie httpOnly.
- As telas do aluno e do responsável chamam a API pelo caminho relativo `/backend`, no mesmo
  endereço do site, então não precisa de CORS.
- Cada requisição pode cair numa instância diferente da API. Por isso tudo o que precisa
  durar entre requisições fica no banco: turmas e histórico, e também a trilha em andamento, a
  credencial do PIN, as tentativas de senha e as recomendações já geradas pela IA.

> **Para a apresentação na faculdade, o plano principal continua sendo rodar local com
> SQLite** (`backend/trilha.db`): não depende da rede. O deploy é para mostrar o projeto
> online e para a banca acessar depois.

## Arquivos de configuração

| Arquivo | Para que serve |
|---|---|
| `vercel.json` | Os dois serviços (`site` na raiz e `api` em `backend/`), a rota `/backend/*` para a API e a ligação interna |
| `.vercelignore` | Deixa de fora a `.venv`, o banco local, os testes e o treino dos modelos |
| `backend/.python-version` | Python 3.12 na API |

## Passo a passo (CLI)

Não precisa instalar nada: `npx vercel` baixa o CLI na hora.

1. **Entrar e ligar a pasta ao projeto**
   ```bash
   npx vercel login
   npx vercel link --project trilha
   ```
2. **Criar o banco** (Neon, plano gratuito, na mesma região das funções). Na primeira vez a
   Vercel pede para aceitar os termos do Neon no navegador. `--no-env-pull` evita sobrescrever o
   `.env.local` usado na apresentação local.
   ```bash
   npx vercel integration add neon --billing-plan free_v3 --meta region=iad1 --meta auth=false --name trilha-db --no-env-pull
   ```
   Isso cria `DATABASE_URL` (com pool) e `DATABASE_URL_UNPOOLED` (direta) no projeto.
3. **Variáveis da aplicação** (produção e preview):

   | Variável | O que colocar |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `/backend` |
   | `PROFESSOR_EMAIL`, `PROFESSOR_NOME`, `PROFESSOR_SENHA` | Conta do painel |
   | `TRILHA_SEGREDO` | Segredo longo e aleatório que assina os logins |
   | `LLM_API_KEY` | Chave da Groq (pode ficar vazia: a IA usa os textos prontos) |
   | `LLM_BASE_URL`, `LLM_MODEL`, `LLM_REASONING_EFFORT`, `LLM_REVISOR_MODEL` | Iguais ao `backend/.env.example` |

   ```bash
   npx vercel env add PROFESSOR_SENHA production --sensitive
   ```
4. **Criar as tabelas e a demonstração** uma vez, da sua máquina, pela conexão direta:
   ```bash
   npx vercel env pull .env.producao --environment=production
   cd backend
   DATABASE_URL="<DATABASE_URL_UNPOOLED do .env.producao>" python -m app.seed
   ```
   (No PowerShell: `$env:DATABASE_URL="..."; python -m app.seed`.) Apague o `.env.producao`
   depois. O mesmo comando recria a demonstração do zero quando quiser.
5. **Publicar**
   ```bash
   npx vercel deploy --prod
   ```
   Com o repositório ligado (`npx vercel git connect`), cada envio à `master` publica sozinho.

## Conferir que está tudo certo

- [ ] `https://<projeto>.vercel.app/backend/saude` responde `{"ok":true,"banco":"postgresql"}`.
- [ ] Login do professor funciona e o painel mostra o 4º ano B.
- [ ] Aluno entra com `SABIA4` e um PIN (os PINs aparecem em **Painel > Turma**), faz uma
      trilha e a atividade aparece no painel.
- [ ] Página **Diagnóstico** mostra as métricas do modelo.
- [ ] Com `LLM_API_KEY`: a **Conversa** responde com IA, o exercício gerado aparece e a
      pergunta por voz é transcrita.

## Como o plano gratuito se comporta

- **Primeira visita mais lenta:** depois de um tempo sem uso, a primeira requisição acorda a
  API (alguns segundos). As seguintes são rápidas.
- **Neon:** o banco também adormece sem uso e acorda na primeira consulta, em menos de um
  segundo. Os dados não se perdem.
- **Prévias** usam o mesmo banco da produção.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `/backend/saude` mostra `"banco":"memória"` | `DATABASE_URL` não chegou ao serviço `api`; confira as variáveis e publique de novo |
| Login recusa a senha certa | A API atualiza a conta quando sobe: depois de mudar `PROFESSOR_SENHA`, publique de novo (`npx vercel deploy --prod`) |
| Painel mostra "Algo deu errado" | A API não respondeu; veja os logs em **Deployments > Functions** |
| Recomendações e conversa sem IA | `LLM_API_KEY` ausente ou cota diária da Groq esgotada (o app usa os textos prontos) |
