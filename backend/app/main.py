"""API do Trilha (FastAPI). Preenche o contrato que o frontend já consome (src/lib/api.ts).

Passo 1: todos os endpoints respondendo contra o estado em memória (app/estado.py), que
espelha o mock do frontend. Próximos passos: persistência no Supabase, diagnóstico com ML
clássico e geração de texto/chat por LLM.

Rodar local:  uvicorn app.main:app --reload --port 8000
No frontend:  NEXT_PUBLIC_API_URL=http://localhost:8000  (sem isso, o front usa o mock dele)
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from . import estado
from .dados import TURMA
from .esquemas import PedidoChatTurma, PedidoPin, PedidoResposta, PedidoSessao, PedidoTurmaConfig
from .estado import ApiErro

app = FastAPI(title="Trilha API", version="0.1.0")

# Em dev, libera as origens do frontend. TRILHA_CORS pode trazer uma lista separada por vírgula.
_origens = os.environ.get("TRILHA_CORS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origens],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiErro)
async def _api_erro(_request, exc: ApiErro):
    return PlainTextResponse(exc.mensagem, status_code=exc.status)


@app.get("/saude")
def saude():
    return {"ok": True, "turma": TURMA["codigo"]}


# --- Painel (professor / responsável) --------------------------------------

@app.get("/alunos")
def get_alunos():
    return estado.lista_alunos_resumo()


@app.get("/alunos/{aluno_id}")
def get_aluno(aluno_id: str):
    return estado.aluno_detalhe(aluno_id)


@app.get("/alunos/{aluno_id}/historico")
def get_historico(aluno_id: str):
    return estado.aluno_historico(aluno_id)


@app.get("/turma/configuracao")
def get_config():
    return estado.config()


@app.put("/turma/configuracao")
def put_config(pedido: PedidoTurmaConfig):
    return estado.salvar_config(pedido.habilidadesAtivas, pedido.disciplinasAtivas)


@app.get("/turma/alunos")
def get_turma_alunos():
    return estado.lista_cadastros()


@app.post("/turma/alunos/{aluno_id}/pin")
def post_regenerar_pin(aluno_id: str):
    return estado.regenerar_pin(aluno_id)


@app.post("/turmas/{turma_id}/chat")
def post_chat(turma_id: str, pedido: PedidoChatTurma):
    if turma_id != TURMA["id"]:
        return JSONResponse("Turma não encontrada", status_code=404)
    return estado.responder_chat_turma(pedido.pergunta)


# --- Aluno (entra pelo código da turma + PIN) ------------------------------

@app.get("/turmas/{codigo}")
def get_turma_publica(codigo: str):
    return estado.turma_publica(codigo)


@app.post("/acesso/pin")
def post_pin(pedido: PedidoPin):
    return estado.validar_pin(pedido.alunoId, pedido.pin)


@app.post("/sessoes")
def post_sessao(pedido: PedidoSessao):
    return estado.iniciar_sessao(pedido.codigo, pedido.alunoId, pedido.acesso, pedido.disciplinaId)


@app.post("/sessoes/{sessao_id}/respostas")
def post_resposta(sessao_id: str, pedido: PedidoResposta):
    return estado.responder(sessao_id, pedido.perguntaId, pedido.opcaoId)


@app.post("/sessoes/{sessao_id}/concluir")
def post_concluir(sessao_id: str):
    return estado.concluir_sessao(sessao_id)
