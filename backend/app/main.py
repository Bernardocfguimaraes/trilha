"""API do Trilha (FastAPI). Preenche o contrato que o frontend já consome (src/lib/api.ts).

Três públicos, três níveis de acesso:
- Professor: login (e-mail + senha) → token; todas as rotas da turma exigem o token.
- Aluno: código da turma + PIN → credencial curta para abrir e responder sessões.
- Responsável: a mesma credencial do PIN, só para ler o progresso daquele aluno.

Rodar local:  uvicorn app.main:app --reload --port 8000
No frontend:  NEXT_PUBLIC_API_URL=http://localhost:8000  (sem isso, o front usa o mock dele)
"""
from __future__ import annotations

import os

from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from . import bd, exercicios, seguranca, voz
from .dados import TURMA
from .esquemas import (
    PedidoChatTurma,
    PedidoExercicio,
    PedidoLogin,
    PedidoPin,
    PedidoProgresso,
    PedidoResposta,
    PedidoSessao,
    PedidoTurmaConfig,
)
from .estado import ApiErro

# Com DATABASE_URL definido, os dados vêm do banco — SQLite ou Postgres (app/repo.py);
# sem ele, do estado em memória (app/estado.py). Os dois expõem as mesmas funções.
if bd.tem_banco():
    from . import repo as fonte

    # SQLite novo (arquivo ainda sem tabelas): cria e popula a demo na hora, para o app
    # nunca subir "quebrado" por falta do seed. No Postgres o seed continua manual, porque
    # ele apaga os dados existentes.
    if bd.engine.dialect.name == "sqlite":
        from sqlalchemy import inspect

        if not inspect(bd.engine).has_table("turmas"):
            from .seed import semear

            semear()
        else:
            # Banco criado antes da tabela de professores: cria só as tabelas que faltam.
            from .modelos import Base

            Base.metadata.create_all(bd.engine)
else:
    from . import estado as fonte

app = FastAPI(title="Trilha API", version="0.2.0")

# Só as origens do frontend chamam a API pelo navegador. TRILHA_CORS aceita uma lista
# separada por vírgula (ex.: para abrir o app pelo IP do notebook na rede local).
_origens = os.environ.get("TRILHA_CORS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origens if o.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def _cabecalhos_seguranca(request: Request, call_next):
    resposta = await call_next(request)
    resposta.headers.setdefault("X-Content-Type-Options", "nosniff")
    resposta.headers.setdefault("X-Frame-Options", "DENY")
    resposta.headers.setdefault("Referrer-Policy", "no-referrer")
    # Dados de alunos nunca ficam em cache de navegador ou proxy.
    resposta.headers.setdefault("Cache-Control", "no-store")
    return resposta


@app.exception_handler(ApiErro)
async def _api_erro(_request, exc: ApiErro):
    return PlainTextResponse(exc.mensagem, status_code=exc.status)


# Conta do professor: vem do .env e é gravada (com hash) no banco ao subir a API.
_conta = seguranca.professor_do_env()
if _conta:
    _existente = fonte.professor_por_email(_conta["email"])
    _atualizada = (
        _existente is not None
        and _existente["nome"] == _conta["nome"]
        and seguranca.conferir_senha(_conta["senha"], _existente["senha_hash"])
    )
    if not _atualizada:
        fonte.salvar_professor(_conta["email"], _conta["nome"], seguranca.hash_senha(_conta["senha"]))
else:
    print("[trilha] Sem PROFESSOR_EMAIL/PROFESSOR_SENHA (mínimo 8 caracteres) no .env: ninguém consegue entrar no painel.")
if seguranca.SEGREDO_TEMPORARIO:
    print("[trilha] TRILHA_SEGREDO ausente ou curto: usando um segredo temporário (os logins caem ao reiniciar a API).")

# Hash descartável para conferir senha mesmo quando o e-mail não existe (ver post_entrar).
_HASH_FALSO = seguranca.hash_senha("senha-que-nunca-confere")


@app.get("/saude")
def saude():
    return {"ok": True, "turma": TURMA["codigo"], "banco": bd.descricao()}


# --- Login do professor -------------------------------------------------------

@app.post("/auth/entrar")
def post_entrar(pedido: PedidoLogin):
    email = pedido.email.strip().lower()
    if seguranca.bloqueado(email):
        raise ApiErro(429, "Muitas tentativas. Espere alguns minutos e tente de novo.")
    conta = fonte.professor_por_email(email)
    # Confere a senha mesmo sem conta, para o tempo de resposta não revelar quais e-mails existem.
    ok = seguranca.conferir_senha(pedido.senha, conta["senha_hash"] if conta else _HASH_FALSO)
    if not conta or not ok:
        seguranca.registrar_erro(email)
        raise ApiErro(401, "E-mail ou senha incorretos.")
    seguranca.limpar_erros(email)
    token, expira = seguranca.emitir_token(conta["email"], conta["nome"])
    return {"token": token, "nome": conta["nome"], "email": conta["email"], "expiraEm": expira}


@app.get("/auth/eu")
def get_eu(professor: dict = Depends(seguranca.professor_atual)):
    return {"nome": professor["nome"], "email": professor["sub"]}


# --- Painel do professor (todas exigem login) ---------------------------------

PROFESSOR = [Depends(seguranca.professor_atual)]


@app.get("/alunos", dependencies=PROFESSOR)
def get_alunos():
    return fonte.lista_alunos_resumo()


@app.get("/alunos/{aluno_id}", dependencies=PROFESSOR)
def get_aluno(aluno_id: str):
    return fonte.aluno_detalhe(aluno_id)


@app.get("/alunos/{aluno_id}/historico", dependencies=PROFESSOR)
def get_historico(aluno_id: str):
    return fonte.aluno_historico(aluno_id)


@app.get("/turma/configuracao", dependencies=PROFESSOR)
def get_config():
    return fonte.config()


@app.put("/turma/configuracao", dependencies=PROFESSOR)
def put_config(pedido: PedidoTurmaConfig):
    return fonte.salvar_config(pedido.habilidadesAtivas, pedido.disciplinasAtivas)


@app.get("/turma/alunos", dependencies=PROFESSOR)
def get_turma_alunos():
    return fonte.lista_cadastros()


@app.post("/diagnostico/reavaliar", dependencies=PROFESSOR)
def post_reavaliar():
    # Re-roda o diagnóstico de ML sobre o histórico de toda a turma.
    return fonte.reavaliar_diagnostico()


@app.post("/turma/alunos/{aluno_id}/pin", dependencies=PROFESSOR)
def post_regenerar_pin(aluno_id: str):
    return fonte.regenerar_pin(aluno_id)


@app.post("/turmas/{turma_id}/chat", dependencies=PROFESSOR)
def post_chat(turma_id: str, pedido: PedidoChatTurma):
    if turma_id != TURMA["id"]:
        return JSONResponse("Turma não encontrada", status_code=404)
    historico = [m.model_dump() for m in pedido.historico]
    return fonte.responder_chat_turma(pedido.pergunta, historico)


@app.post("/exercicios/gerar", dependencies=PROFESSOR)
def post_exercicio(pedido: PedidoExercicio):
    # Gera um exercício de reforço (via LLM, com fallback no banco curado).
    try:
        return exercicios.gerar_exercicio(pedido.habilidadeId, pedido.nivel)
    except ValueError as e:
        return JSONResponse(str(e), status_code=404)


AUDIO_MAX_BYTES = 8 * 1024 * 1024  # alguns minutos de fala em webm


@app.post("/voz/transcrever", dependencies=PROFESSOR)
async def post_transcrever(audio: UploadFile = File(...)):
    # STT: recebe um áudio curto (gravado no navegador) e devolve o texto (Whisper/Groq).
    dados = await audio.read(AUDIO_MAX_BYTES + 1)
    if not dados:
        return JSONResponse("Áudio vazio", status_code=400)
    if len(dados) > AUDIO_MAX_BYTES:
        return JSONResponse("Áudio grande demais. Grave um trecho mais curto.", status_code=413)
    texto = voz.transcrever(dados, audio.filename or "audio.webm", audio.content_type or "audio/webm")
    if texto is None:
        return JSONResponse("Não foi possível transcrever o áudio", status_code=502)
    return {"texto": texto}


# --- Aluno (entra pelo código da turma + PIN) ------------------------------

@app.get("/turmas/{codigo}")
def get_turma_publica(codigo: str):
    return fonte.turma_publica(codigo)


@app.post("/acesso/pin")
def post_pin(pedido: PedidoPin):
    return fonte.validar_pin(pedido.alunoId, pedido.pin)


# --- Responsável (código da turma + PIN do filho, só leitura) ---------------

@app.post("/responsavel/progresso")
def post_progresso_responsavel(pedido: PedidoProgresso):
    # O aluno vem da credencial, nunca de um id enviado pelo cliente: com o PIN de um
    # filho não há como pedir os dados de outro aluno, da turma ou da configuração.
    aluno_id = fonte.aluno_do_acesso(pedido.acesso)
    if not aluno_id:
        raise ApiErro(401, "Acesso expirado. Digite o PIN de novo.")
    return {"aluno": fonte.aluno_detalhe(aluno_id), "historico": fonte.aluno_historico(aluno_id)}


# Sessões: abrir exige a credencial do PIN; responder e concluir usam o id da sessão,
# que é aleatório e só quem abriu a sessão conhece.
@app.post("/sessoes")
def post_sessao(pedido: PedidoSessao):
    return fonte.iniciar_sessao(pedido.codigo, pedido.alunoId, pedido.acesso, pedido.disciplinaId)


@app.post("/sessoes/{sessao_id}/respostas")
def post_resposta(sessao_id: str, pedido: PedidoResposta):
    return fonte.responder(sessao_id, pedido.perguntaId, pedido.opcaoId)


@app.post("/sessoes/{sessao_id}/concluir")
def post_concluir(sessao_id: str):
    return fonte.concluir_sessao(sessao_id)
