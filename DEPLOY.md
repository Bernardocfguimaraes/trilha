# Deploy da Trilha (planos gratuitos)

Tudo aqui usa planos gratuitos, sem cartão: **Vercel** para o front (Next.js), **Render** para
a API (FastAPI) e, se quiser guardar dados de verdade, **Supabase** para o Postgres. A IA
continua no plano gratuito da Groq.

```
navegador ──► Vercel (Next.js) ──► Render (FastAPI) ──► SQLite no disco do serviço
   │              │ ponte /api/professor                 ou Postgres do Supabase
   └──────────────┴────────────────► Render (rotas do aluno e do responsável)
```

O painel do professor fala com a API pelo servidor do Vercel (o token fica num cookie
httpOnly). As telas do aluno e do responsável chamam a API direto do navegador, por isso a API
precisa liberar o endereço do front no CORS.

> **Para a apresentação na faculdade, o plano principal continua sendo rodar local com
> SQLite** (`backend/trilha.db`): não depende da rede. O deploy é para mostrar o projeto
> online e para a banca acessar depois.

## 1. API no Render

1. Crie uma conta em <https://render.com> (dá para entrar com o GitHub).
2. **New > Blueprint** e escolha o repositório `trilha`. O Render lê o `render.yaml` da raiz.
3. Preencha os valores que ele pedir:

   | Variável | O que colocar |
   |---|---|
   | `PROFESSOR_EMAIL` | e-mail do login do professor |
   | `PROFESSOR_SENHA` | uma senha forte (é ela que você vai digitar no painel) |
   | `TRILHA_CORS` | endereço do front no Vercel, ex.: `https://trilha.vercel.app` (preencha depois do passo 2, se ainda não souber) |
   | `TRILHA_CORS_REGEX` | opcional, para as prévias do Vercel: `https://trilha(-[a-z0-9-]+)?\.vercel\.app` |
   | `LLM_API_KEY` | chave da Groq (<https://console.groq.com> > API Keys). Pode ficar vazia: aí a IA usa os textos prontos |

   `TRILHA_SEGREDO` é gerado pelo próprio Render. O resto já vem preenchido.
4. Espere o primeiro deploy e abra `https://<seu-servico>.onrender.com/saude`. Deve aparecer
   `{"ok":true,"banco":"sqlite"}`.

**Como o plano gratuito se comporta:**
- O serviço **dorme depois de 15 minutos sem uso**. A primeira visita depois disso demora
  uns 50 segundos. Antes de mostrar para alguém, abra `/saude` e espere responder.
- O disco é apagado a cada deploy ou reinício. Com SQLite, a API recria a demo sozinha ao
  subir: o 4º ano B com histórico e o 8º ano A vazio. O que for feito durante o uso se perde
  quando o serviço reinicia.

## 2. Front no Vercel

1. Crie uma conta em <https://vercel.com> com o GitHub.
2. **Add New > Project** e importe o repositório `trilha`. O Vercel reconhece o Next.js;
   deixe a pasta raiz como está.
3. Em **Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | o endereço da API, ex.: `https://trilha-api.onrender.com` (sem barra no fim) |

4. Clique em **Deploy**. Quando terminar, copie o endereço do site (ex.:
   `https://trilha.vercel.app`) e coloque em `TRILHA_CORS` lá no Render (**Environment**).
   O Render faz um novo deploy sozinho.
5. Abra o site, entre em **Sou professor** com o e-mail e a senha do passo 1 e confira o
   painel. Depois, numa aba anônima, entre como aluno com o código `SABIA4`.

`NEXT_PUBLIC_API_URL` entra no código no momento do build: se mudar o endereço da API, faça
um novo deploy no Vercel (**Deployments > Redeploy**).

## 3. Opcional: dados que não somem (Supabase)

1. Crie um projeto gratuito em <https://supabase.com>.
2. **Project Settings > Database > Connection string > URI**: copie a URL e troque
   `[YOUR-PASSWORD]` pela senha do banco.
3. No Render, troque `DATABASE_URL` por essa URL.
4. Crie as tabelas e a demo **uma vez**, da sua máquina, apontando para o Supabase:
   ```bash
   cd backend
   DATABASE_URL="postgresql://..." python -m app.seed
   ```
   (No PowerShell: `$env:DATABASE_URL="postgresql://..."; python -m app.seed`.)
5. Abra `/saude` de novo: deve aparecer `"banco":"postgresql"`.

O plano gratuito do Supabase pausa o projeto depois de uma semana sem uso. Para reativar, é
só entrar no painel do Supabase e clicar em **Restore**.

## 4. Opcional: só o front, sem API

Sem `NEXT_PUBLIC_API_URL`, o site roda com dados de exemplo (o modo usado para desenvolver a
interface): o 4º ano B completo, o 8º ano A e as turmas que você criar, tudo na memória do
servidor. As atividades das turmas novas e a IA precisam da API.

Nesse modo, **defina `PROFESSOR_SENHA`** (e, se quiser, `PROFESSOR_EMAIL` e `PROFESSOR_NOME`)
nas variáveis do Vercel. Sem isso, o login usa a senha de exemplo do código, que é pública.

## Conferir que está tudo certo

- [ ] `https://<api>/saude` responde `ok: true`.
- [ ] Login do professor funciona e o painel mostra o 4º ano B.
- [ ] Aluno entra com `SABIA4` e um PIN (os PINs aparecem em **Painel > Turma**), faz uma
      trilha e a atividade aparece no painel.
- [ ] Página **Diagnóstico** mostra as métricas do modelo.
- [ ] Com `LLM_API_KEY`: a **Conversa** responde com IA e o exercício gerado aparece.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Tela do aluno: "não deu para conferir agora" | CORS: o endereço do front não está em `TRILHA_CORS` (confira `https` e sem barra no fim) |
| Painel demora quase um minuto para abrir | A API estava dormindo (plano gratuito); depois da primeira visita fica rápido |
| Login recusa a senha certa | `PROFESSOR_SENHA` foi alterada e a API ainda não reiniciou; faça **Manual Deploy** no Render |
| Os dados sumiram | Reinício do Render com SQLite; use o Supabase (passo 3) se precisar guardar |
