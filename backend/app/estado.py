"""Estado em memória + regras de negócio — port de src/lib/mock.ts.

Esta é a camada que o Supabase vai substituir mais à frente: as funções continuam,
só a leitura/gravação deixa de ser um dict em memória e passa a ser o Postgres.
Diagnóstico ainda é simples (média de desempenho → status); o ML clássico entra depois.
"""
from __future__ import annotations

import math
import random
import uuid
from datetime import datetime, timedelta, timezone

from . import chat, diagnostico
from . import recomendacoes as rec
from .adaptacao import NIVEIS, estado_inicial_adaptacao, registrar_resposta
from .dados import (
    ALUNOS,
    BANCO,
    DISCIPLINAS,
    HABILIDADES,
    PINS_INICIAIS,
    STATUS,
    TEXTOS,
    TURMA,
    nome_disciplina,
)


class ApiErro(Exception):
    """Erro com status HTTP, convertido em resposta pelo main.py."""

    def __init__(self, status: int, mensagem: str):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


def _arred(x: float) -> int:
    """Arredonda como o Math.round do JS (meio para cima) — vale para valores >= 0."""
    return math.floor(x + 0.5)


def _hoje() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _agora_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def _curto(nome: str) -> str:
    partes = nome.split(" ")
    return f"{partes[0]} {partes[-1][0]}."


# --- Estado mutável ---------------------------------------------------------

PERGUNTAS_POR_SESSAO = 6
MAX_ERROS_PIN = 5
ESPERA_BLOQUEIO_MS = 60_000
ELOGIOS = ["Isso aí!", "Mandou bem!", "Acertou!", "Muito bem!"]
# Pontuação por resposta: acertar uma difícil vale mais; errar uma difícil pesa menos.
PONTOS_RESPOSTA = {
    "facil": {"certa": 60, "errada": 0},
    "medio": {"certa": 80, "errada": 20},
    "dificil": {"certa": 100, "errada": 40},
}


class Estado:
    def __init__(self):
        self.registros: dict[str, list[dict]] = {}          # alunoId -> [{data, desempenho}]
        self.status_atual: dict[str, str] = {}              # "alunoId:habId" -> status recalculado
        self.ultima_atividade: dict[str, str] = {}          # alunoId -> data
        self.ativas: set[str] = {h["id"] for h in HABILIDADES if h["id"] != "por-producao"}
        self.disciplinas_ativas: set[str] = {d["id"] for d in DISCIPLINAS}
        self.sessoes: dict[str, dict] = {}
        self.pins: dict[str, str] = dict(PINS_INICIAIS)
        self.acessos: dict[str, str] = {}                   # credencial -> alunoId
        self.tentativas: dict[str, dict] = {}               # alunoId -> {erros, bloqueadoAte}


estado = Estado()


def _aluno(aluno_id: str) -> dict | None:
    return next((a for a in ALUNOS if a["id"] == aluno_id), None)


# --- Habilidades / status ---------------------------------------------------

def habilidades_de(status: str, aluno_id: str | None = None) -> list[dict]:
    disciplinas_ativas_nomes = {d["nome"] for d in DISCIPLINAS if d["id"] in estado.disciplinas_ativas}
    saida = []
    for i, h in enumerate(HABILIDADES):
        st = estado.status_atual.get(f"{aluno_id}:{h['id']}", STATUS[status[i]])
        if h["id"] in estado.ativas and h["disciplina"] in disciplinas_ativas_nomes:
            saida.append({"habilidadeId": h["id"], "nome": h["nome"], "disciplina": h["disciplina"], "status": st})
    return saida


def _ultima_de(a: dict) -> str | None:
    return estado.ultima_atividade.get(a["id"], a["ultima"])


def resumo(a: dict) -> dict:
    return {
        "id": a["id"],
        "nome": a["nome"],
        "turma": TURMA["nome"],
        "ultimaAtividade": _ultima_de(a),
        "habilidades": habilidades_de(a["status"], a["id"]),
    }


def detalhe(a: dict) -> dict:
    habilidades = habilidades_de(a["status"], a["id"])
    recomendacoes = []
    for h in habilidades:
        if h["status"] == "alerta" or (h["status"] == "atencao" and TEXTOS.get(h["habilidadeId"])):
            recomendacoes.append({
                "habilidadeId": h["habilidadeId"],
                "habilidade": h["nome"],
                "status": h["status"],
                "texto": rec.texto_para(h["habilidadeId"], h["nome"], h["disciplina"], h["status"]),
                "geradaEm": _ultima_de(a) or "2026-10-13",
            })
    return {**resumo(a), "recomendacoes": recomendacoes}


# --- Histórico --------------------------------------------------------------

def _sessoes_iniciais(a: dict) -> list[dict]:
    """Sessões de exemplo anteriores à demo, coerentes com o status de cada habilidade."""
    if not a["ultima"]:
        return []  # quem nunca fez atividade não tem histórico
    datas: list[str] = []
    passo = [3, 4] if a["id"] == "a2" else [7]
    d = datetime(2026, 8, 24, tzinfo=timezone.utc).date()
    fim = datetime.fromisoformat(a["ultima"]).date()
    i = 0
    while d <= fim:
        datas.append(d.isoformat())
        d = d + timedelta(days=passo[i % len(passo)])
        i += 1
    alvo = {"ok": 82, "atencao": 61, "alerta": 42}
    registros = []
    for idx, data in enumerate(datas):
        t = idx / max(len(datas) - 1, 1)
        desempenho = {}
        for hi, h in enumerate(HABILIDADES):
            status = STATUS[a["status"][hi]]
            inicio = 58 + (hi % 3) * 6 if status == "ok" else 55 if status == "atencao" else 60
            ruido = ((hi * 7 + idx * 13) % 9) - 4
            desempenho[h["id"]] = max(0, min(100, _arred(inicio + (alvo[status] - inicio) * t + ruido)))
        registros.append({"data": data, "desempenho": desempenho})
    return registros


def _registros_de(a: dict) -> list[dict]:
    r = estado.registros.get(a["id"])
    if r is None:
        r = _sessoes_iniciais(a)
        estado.registros[a["id"]] = r
    return r


def _serie(a: dict, habilidade_id: str) -> list[dict]:
    """Série de uma habilidade: uma entrada por dia (média quando houve mais de uma)."""
    por_dia: dict[str, list[int]] = {}
    for r in _registros_de(a):
        v = r["desempenho"].get(habilidade_id)
        if v is not None:
            por_dia.setdefault(r["data"], []).append(v)
    return [
        {"data": data, "desempenho": _arred(sum(vs) / len(vs))}
        for data, vs in sorted(por_dia.items(), key=lambda kv: kv[0])
    ]


def historico(a: dict) -> list[dict]:
    return [
        {"habilidadeId": h["habilidadeId"], "nome": h["nome"], "disciplina": h["disciplina"], "pontos": _serie(a, h["habilidadeId"])}
        for h in habilidades_de(a["status"], a["id"])
    ]


def _registrar_sessao(s: dict) -> None:
    """Acrescenta a sessão concluída ao histórico e recalcula o status das habilidades tocadas."""
    aluno = _aluno(s["alunoId"])
    if not aluno or len(s["respostas"]) == 0:
        return
    hoje = _hoje()
    pontos: dict[str, list[int]] = {}
    for r in s["respostas"]:
        p = PONTOS_RESPOSTA[r["nivel"]]["certa" if r["correta"] else "errada"]
        pontos.setdefault(r["habilidadeId"], []).append(p)
    desempenho = {hid: _arred(sum(ps) / len(ps)) for hid, ps in pontos.items()}
    _registros_de(aluno).append({"data": hoje, "desempenho": desempenho})
    estado.ultima_atividade[aluno["id"]] = hoje
    # Status recalculado pelo diagnóstico de ML (passo 3), a partir da série da habilidade.
    for hid in pontos.keys():
        estado.status_atual[f"{aluno['id']}:{hid}"] = diagnostico.classificar(_serie(aluno, hid))


def reavaliar_diagnostico() -> dict:
    """Re-diagnostica todos os alunos a partir do histórico, usando o modelo de ML.
    Útil para a demo: mostra o modelo classificando a turma inteira de uma vez."""
    atualizados = 0
    for a in ALUNOS:
        for h in HABILIDADES:
            s = _serie(a, h["id"])
            if s:
                estado.status_atual[f"{a['id']}:{h['id']}"] = diagnostico.classificar(s)
                atualizados += 1
    return {"reavaliados": atualizados, "modelo": "ml" if diagnostico.tem_modelo() else "regra"}


# --- Configuração da turma --------------------------------------------------

def config() -> dict:
    ordem = ["mat", "por", "geo", "cie", "ing"]  # painel: Matemática e Português primeiro
    disciplinas = []
    for did in ordem:
        nome = nome_disciplina(did)
        disciplinas.append({
            "id": did,
            "nome": nome,
            "ativa": did in estado.disciplinas_ativas,
            "habilidades": [
                {"id": h["id"], "nome": h["nome"], "descricao": h["descricao"], "ativa": h["id"] in estado.ativas}
                for h in HABILIDADES
                if h["disciplina"] == nome
            ],
        })
    return {"turma": TURMA, "ciclo": "4º bimestre de 2026", "disciplinas": disciplinas}


# --- Sessão / perguntas -----------------------------------------------------

def _habilidades_da_sessao(disciplina_id: str | None) -> list[str]:
    ids = []
    for h in HABILIDADES:
        disc = next(d for d in DISCIPLINAS if d["nome"] == h["disciplina"])
        if (
            h["id"] in estado.ativas
            and disc["id"] in estado.disciplinas_ativas
            and (not disciplina_id or disc["id"] == disciplina_id)
            and any(p["habilidadeId"] == h["id"] for p in BANCO)
        ):
            ids.append(h["id"])
    return ids


def _escolher_pergunta(habilidades: list[str], nivel: str, usadas: set[str], vez: int) -> dict | None:
    """Próxima pergunta não usada: de preferência no nível pedido e na habilidade da vez."""
    if not habilidades:
        return None
    alvo = habilidades[vez % len(habilidades)]

    def custo(p: dict) -> float:
        return abs(NIVEIS.index(p["nivel"]) - NIVEIS.index(nivel)) * 10 + (0 if p["habilidadeId"] == alvo else 1) + random.random() * 0.5

    candidatas = [p for p in BANCO if p["habilidadeId"] in habilidades and p["id"] not in usadas]
    if not candidatas:
        return None
    return min(candidatas, key=custo)


def _para_cliente(p: dict) -> dict:
    disciplina = next(h["disciplina"] for h in HABILIDADES if h["id"] == p["habilidadeId"])
    return {
        "id": p["id"],
        "disciplina": disciplina,
        "habilidadeId": p["habilidadeId"],
        "nivel": p["nivel"],
        "enunciado": p["enunciado"],
        "apoio": p.get("apoio"),
        "opcoes": [{"id": f"{p['id']}-{i}", "texto": texto} for i, texto in enumerate(p["opcoes"])],
    }


# --- PIN / cadastro ---------------------------------------------------------

def cadastro(a: dict) -> dict:
    return {"id": a["id"], "nome": a["nome"], "pin": estado.pins[a["id"]]}


def _novo_pin(anterior: str | None = None) -> str:
    while True:
        pin = str(random.randint(0, 9999)).zfill(4)
        if pin != anterior and len(set(pin)) != 1:  # evita repetir o anterior e 0000, 1111…
            return pin


def validar_pin(aluno_id: str, pin: str) -> dict:
    if not _aluno(aluno_id):
        raise ApiErro(404, "Aluno não encontrado")
    t = estado.tentativas.get(aluno_id, {"erros": 0, "bloqueadoAte": 0})
    if t["bloqueadoAte"] > _agora_ms():
        return {"valido": False, "acesso": None, "bloqueado": True}
    if estado.pins.get(aluno_id) != pin:
        t["erros"] += 1
        if t["erros"] >= MAX_ERROS_PIN:
            t["erros"] = 0
            t["bloqueadoAte"] = _agora_ms() + ESPERA_BLOQUEIO_MS
        estado.tentativas[aluno_id] = t
        return {"valido": False, "acesso": None, "bloqueado": t["bloqueadoAte"] > _agora_ms()}
    estado.tentativas.pop(aluno_id, None)
    acesso = f"acesso-{aluno_id}-{uuid.uuid4()}"
    estado.acessos[acesso] = aluno_id
    return {"valido": True, "acesso": acesso, "bloqueado": False}


def regenerar_pin(aluno_id: str) -> dict:
    aluno = _aluno(aluno_id)
    if not aluno:
        raise ApiErro(404, "Aluno não encontrado")
    estado.pins[aluno["id"]] = _novo_pin(estado.pins.get(aluno["id"]))
    estado.tentativas.pop(aluno["id"], None)
    # O PIN antigo deixa de valer, inclusive para quem já tinha entrado com ele.
    for acesso in [k for k, v in estado.acessos.items() if v == aluno["id"]]:
        estado.acessos.pop(acesso, None)
    return cadastro(aluno)


# --- Chat -------------------------------------------------------------------

def _retrato_turma() -> chat.RetratoTurma:
    por_aluno = [{"a": a, "habilidades": habilidades_de(a["status"], a["id"])} for a in ALUNOS]
    ativas = por_aluno[0]["habilidades"] if por_aluno else []
    semana_passada = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

    def media(ps):
        return sum(p["desempenho"] for p in ps) / max(len(ps), 1)

    evolucao = []
    for a in ALUNOS:
        if len(_registros_de(a)) > 1:
            series = [s for s in (_serie(a, h["habilidadeId"]) for h in ativas) if len(s) > 1]
            inicio = media([p for s in series for p in s[:2]])
            fim = media([p for s in series for p in s[-2:]])
            evolucao.append({"aluno": _curto(a["nome"]), "variacao": _arred(fim - inicio)})

    return {
        "turma": TURMA["nome"],
        "habilidades": [
            {
                "id": h["habilidadeId"],
                "nome": h["nome"],
                "disciplina": h["disciplina"],
                "alerta": [_curto(x["a"]["nome"]) for x in por_aluno if any(y["habilidadeId"] == h["habilidadeId"] and y["status"] == "alerta" for y in x["habilidades"])],
                "atencao": [_curto(x["a"]["nome"]) for x in por_aluno if any(y["habilidadeId"] == h["habilidadeId"] and y["status"] == "atencao" for y in x["habilidades"])],
            }
            for h in ativas
        ],
        "evolucao": evolucao,
        "semAtividade": [_curto(a["nome"]) for a in ALUNOS if (_ultima_de(a) or "") < semana_passada],
    }


def responder_chat_turma(pergunta: str, historico: list[dict] | None = None) -> dict:
    retrato = _retrato_turma()
    texto = chat.responder_llm(pergunta, retrato, historico) or chat.responder_chat(pergunta, retrato)
    return {
        "id": f"m{_agora_ms()}",
        "autor": "assistente",
        "texto": texto,
        "enviadaEm": datetime.now(timezone.utc).isoformat(),
    }


# --- Operações expostas ao main --------------------------------------------

def lista_alunos_resumo() -> list[dict]:
    return [resumo(a) for a in ALUNOS]


def aluno_detalhe(aluno_id: str) -> dict:
    a = _aluno(aluno_id)
    if not a:
        raise ApiErro(404, "Aluno não encontrado")
    return detalhe(a)


def aluno_historico(aluno_id: str) -> list[dict]:
    a = _aluno(aluno_id)
    if not a:
        raise ApiErro(404, "Aluno não encontrado")
    return historico(a)


def lista_cadastros() -> list[dict]:
    return [cadastro(a) for a in ALUNOS]


def salvar_config(habilidades_ativas: list[str], disciplinas_ativas: list[str] | None) -> dict:
    estado.ativas = set(habilidades_ativas)
    if disciplinas_ativas is not None:
        estado.disciplinas_ativas = set(disciplinas_ativas)
    return config()


def turma_publica(codigo: str) -> dict:
    if codigo.upper() != TURMA["codigo"]:
        raise ApiErro(404, "Turma não encontrada")
    return {
        "codigo": TURMA["codigo"],
        "nome": TURMA["nome"],
        "alunos": [{"id": a["id"], "nome": _curto(a["nome"])} for a in ALUNOS],
        "disciplinas": [{"id": d["id"], "nome": d["nome"]} for d in DISCIPLINAS if len(_habilidades_da_sessao(d["id"])) > 0],
    }


def iniciar_sessao(codigo: str, aluno_id: str, acesso: str | None, disciplina_id: str | None) -> dict:
    # Sem a credencial do PIN, ninguém abre sessão em nome de outro aluno.
    if not acesso or estado.acessos.get(acesso) != aluno_id:
        raise ApiErro(401, "Confirme o PIN do aluno antes de começar")
    habilidades = _habilidades_da_sessao(disciplina_id)
    if len(habilidades) == 0:
        raise ApiErro(404, "Nenhuma habilidade ativa nesta disciplina")
    adaptacao = estado_inicial_adaptacao()
    reservadas: set[str] = set()
    perguntas: list[dict] = []
    for i in range(PERGUNTAS_POR_SESSAO):
        p = _escolher_pergunta(habilidades, adaptacao.nivel, reservadas, i)
        if not p:
            break
        reservadas.add(p["id"])
        perguntas.append(p)
    sessao_id = f"s{_agora_ms()}"
    estado.sessoes[sessao_id] = {
        "acertos": 0,
        "alunoId": aluno_id,
        "total": len(perguntas),
        "habilidades": habilidades,
        "usadas": {perguntas[0]["id"]},
        "adaptacao": adaptacao,
        "respostas": [],
        "concluida": False,
    }
    return {"sessaoId": sessao_id, "perguntas": [_para_cliente(p) for p in perguntas]}


def responder(sessao_id: str, pergunta_id: str, opcao_id: str) -> dict:
    p = next((q for q in BANCO if q["id"] == pergunta_id), None)
    if not p:
        raise ApiErro(404, "Pergunta não encontrada")
    certa_id = f"{p['id']}-{p['certa']}"
    correta = opcao_id == certa_id
    s = estado.sessoes.get(sessao_id)
    if s and correta:
        s["acertos"] += 1
    r = {
        "correta": correta,
        "opcaoCorretaId": certa_id,
        "mensagem": random.choice(ELOGIOS) if correta else f"Quase! A resposta é {p['opcoes'][p['certa']]}.",
    }
    if s and not any(q["perguntaId"] == p["id"] for q in s["respostas"]):
        s["usadas"].add(p["id"])
        s["respostas"].append({"perguntaId": p["id"], "habilidadeId": p["habilidadeId"], "nivel": p["nivel"], "correta": correta})
        s["adaptacao"] = registrar_resposta(s["adaptacao"], correta)
        if len(s["respostas"]) < s["total"]:
            proxima = _escolher_pergunta(s["habilidades"], s["adaptacao"].nivel, s["usadas"], len(s["respostas"]))
            if proxima:
                s["usadas"].add(proxima["id"])
                r["proxima"] = _para_cliente(proxima)
    return r


def concluir_sessao(sessao_id: str) -> dict:
    s = estado.sessoes.get(sessao_id)
    if s and not s["concluida"]:
        s["concluida"] = True
        _registrar_sessao(s)
    acertos = s["acertos"] if s else 0
    total = s["total"] if s else PERGUNTAS_POR_SESSAO
    return {
        "estrelas": acertos,
        "total": total,
        "mensagem": "Você chegou ao fim da trilha voando!" if acertos >= total - 1 else "Você chegou ao fim da trilha!",
    }
