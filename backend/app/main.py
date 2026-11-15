from __future__ import annotations

import os

from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response

from . import bd, diagnostico, exercicios, risco, seguranca, voz
from . import repo as fonte
from .esquemas import (
    PedidoAvaliacao,
    PedidoChatTurma,
    PedidoExercicio,
    PedidoLogin,
    PedidoNovaTurma,
    PedidoNovoAluno,
    PedidoPin,
    PedidoProgresso,
    PedidoResposta,
    PedidoSessao,
    PedidoTurmaConfig,
)
from .regras import ApiErro

if bd.engine.dialect.name == "sqlite":
    from sqlalchemy import inspect

    from .modelos import Base

    _insp = inspect(bd.engine)
    _antigo = not _insp.has_table("turmas") or "professor_email" not in {c["name"] for c in _insp.get_columns("turmas")}
    if bd.EM_MEMORIA or _antigo:
        from .seed import semear

        semear()
    else:
        Base.metadata.create_all(bd.engine)

if not bd.EM_MEMORIA:
    from sqlalchemy import inspect as _inspecionar

    if _inspecionar(bd.engine).has_table("habilidades"):
        from .seed import sincronizar_catalogo

        _novas = sincronizar_catalogo()
        if _novas:
            print(f"Catálogo atualizado: {_novas} habilidades novas.")

app = FastAPI(title="Trilha API", version="0.2.0")

_origens = os.environ.get("TRILHA_CORS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origens if o.strip()],
    allow_origin_regex=os.environ.get("TRILHA_CORS_REGEX") or None,
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
    resposta.headers.setdefault("Cache-Control", "no-store")
    return resposta


@app.exception_handler(ApiErro)
async def _api_erro(_request, exc: ApiErro):
    return PlainTextResponse(exc.mensagem, status_code=exc.status)


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
    fonte.adotar_turmas_orfas(_conta["email"])
else:
    print("[trilha] Sem PROFESSOR_EMAIL/PROFESSOR_SENHA (mínimo 8 caracteres) no .env: ninguém consegue entrar no painel.")
if seguranca.SEGREDO_TEMPORARIO:
    print("[trilha] TRILHA_SEGREDO ausente ou curto: usando um segredo temporário (os logins caem ao reiniciar a API).")

_HASH_FALSO = seguranca.hash_senha("senha-que-nunca-confere")


@app.get("/saude")
def saude():
    return {"ok": True, "banco": bd.descricao()}


@app.post("/auth/entrar")
def post_entrar(pedido: PedidoLogin):
    email = pedido.email.strip().lower()
    if seguranca.bloqueado(email):
        raise ApiErro(429, "Muitas tentativas. Espere alguns minutos e tente de novo.")
    conta = fonte.professor_por_email(email)
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


PROFESSOR = [Depends(seguranca.professor_atual)]
Professor = Depends(seguranca.professor_atual)


@app.get("/anos")
def get_anos(professor: dict = Professor):
    return fonte.anos_disponiveis()


@app.get("/turmas")
def get_turmas(professor: dict = Professor):
    return fonte.listar_turmas(professor["sub"])


@app.post("/turmas", status_code=201)
def post_turma(pedido: PedidoNovaTurma, professor: dict = Professor):
    return fonte.criar_turma(professor["sub"], pedido.nome, pedido.ano, pedido.alunos)


@app.get("/turmas/{turma_id}/alunos")
def get_alunos(turma_id: str, professor: dict = Professor):
    return fonte.lista_alunos_resumo(professor["sub"], turma_id)


@app.post("/turmas/{turma_id}/alunos", status_code=201)
def post_aluno(turma_id: str, pedido: PedidoNovoAluno, professor: dict = Professor):
    return fonte.adicionar_aluno(professor["sub"], turma_id, pedido.nome)


@app.get("/turmas/{turma_id}/cadastros")
def get_cadastros(turma_id: str, professor: dict = Professor):
    return fonte.lista_cadastros(professor["sub"], turma_id)


@app.get("/turmas/{turma_id}/configuracao")
def get_config(turma_id: str, professor: dict = Professor):
    return fonte.config(professor["sub"], turma_id)


@app.put("/turmas/{turma_id}/configuracao")
def put_config(turma_id: str, pedido: PedidoTurmaConfig, professor: dict = Professor):
    return fonte.salvar_config(professor["sub"], turma_id, pedido.habilidadesAtivas, pedido.disciplinasAtivas)


@app.post("/turmas/{turma_id}/diagnostico")
def post_reavaliar(turma_id: str, professor: dict = Professor):
    return fonte.reavaliar_diagnostico(professor["sub"], turma_id)


@app.get("/turmas/{turma_id}/relatorio.csv")
def get_relatorio_csv(turma_id: str, professor: dict = Professor):
    nome, conteudo = fonte.relatorio_turma_csv(professor["sub"], turma_id)
    return Response(conteudo, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{nome}"'})


@app.get("/turmas/{turma_id}/grupos")
def get_grupos(turma_id: str, professor: dict = Professor):
    return fonte.grupos_da_turma(professor["sub"], turma_id)


@app.post("/turmas/{turma_id}/chat")
def post_chat(turma_id: str, pedido: PedidoChatTurma, professor: dict = Professor):
    historico = [m.model_dump() for m in pedido.historico]
    return fonte.responder_chat_turma(professor["sub"], turma_id, pedido.pergunta, historico)


@app.get("/alunos/{aluno_id}")
def get_aluno(aluno_id: str, professor: dict = Professor):
    return fonte.aluno_detalhe(professor["sub"], aluno_id)


@app.get("/alunos/{aluno_id}/historico")
def get_historico(aluno_id: str, professor: dict = Professor):
    return fonte.aluno_historico(professor["sub"], aluno_id)


@app.get("/alunos/{aluno_id}/diagnostico")
def get_diagnostico_aluno(aluno_id: str, professor: dict = Professor):
    return fonte.diagnostico_do_aluno(professor["sub"], aluno_id)


@app.put("/alunos/{aluno_id}/diagnostico/{habilidade_id}")
def put_avaliacao(aluno_id: str, habilidade_id: str, pedido: PedidoAvaliacao, professor: dict = Professor):
    return fonte.avaliar_diagnostico(professor["sub"], aluno_id, habilidade_id, pedido.status)


@app.get("/modelo")
def get_modelo(professor: dict = Professor):
    m = diagnostico.metricas()
    if m is None:
        raise ApiErro(404, "Modelo ainda não treinado (rode python -m ml.treinar).")
    return {**m, "professores": fonte.concordancia_professores(), "risco": risco.metricas(),
            "llm": exercicios.avaliacao()}


@app.post("/alunos/{aluno_id}/pin")
def post_regenerar_pin(aluno_id: str, professor: dict = Professor):
    return fonte.regenerar_pin(professor["sub"], aluno_id)


@app.post("/exercicios/gerar", dependencies=PROFESSOR)
def post_exercicio(pedido: PedidoExercicio):
    try:
        return exercicios.gerar_exercicio(pedido.habilidadeId, pedido.nivel)
    except ValueError as e:
        return JSONResponse(str(e), status_code=404)


AUDIO_MAX_BYTES = 8 * 1024 * 1024


@app.post("/voz/transcrever", dependencies=PROFESSOR)
async def post_transcrever(audio: UploadFile = File(...)):
    dados = await audio.read(AUDIO_MAX_BYTES + 1)
    if not dados:
        return JSONResponse("Áudio vazio", status_code=400)
    if len(dados) > AUDIO_MAX_BYTES:
        return JSONResponse("Áudio grande demais. Grave um trecho mais curto.", status_code=413)
    texto = voz.transcrever(dados, audio.filename or "audio.webm", audio.content_type or "audio/webm")
    if texto is None:
        return JSONResponse("Não foi possível transcrever o áudio", status_code=502)
    return {"texto": texto}


@app.get("/turmas/{codigo}")
def get_turma_publica(codigo: str):
    return fonte.turma_publica(codigo)


@app.post("/acesso/pin")
def post_pin(pedido: PedidoPin):
    return fonte.validar_pin(pedido.alunoId, pedido.pin)


@app.post("/responsavel/progresso")
def post_progresso_responsavel(pedido: PedidoProgresso):
    aluno_id = fonte.aluno_do_acesso(pedido.acesso)
    if not aluno_id:
        raise ApiErro(401, "Acesso expirado. Digite o PIN de novo.")
    return fonte.progresso_do_aluno(aluno_id)


@app.post("/sessoes")
def post_sessao(pedido: PedidoSessao):
    return fonte.iniciar_sessao(pedido.codigo, pedido.alunoId, pedido.acesso, pedido.disciplinaId)


@app.post("/sessoes/{sessao_id}/respostas")
def post_resposta(sessao_id: str, pedido: PedidoResposta):
    return fonte.responder(sessao_id, pedido.perguntaId, pedido.opcaoId)


@app.post("/sessoes/{sessao_id}/concluir")
def post_concluir(sessao_id: str):
    return fonte.concluir_sessao(sessao_id)
