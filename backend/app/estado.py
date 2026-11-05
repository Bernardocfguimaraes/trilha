"""Estado em memória + regras de negócio — port de src/lib/mock.ts.

Esta é a camada que o Supabase vai substituir mais à frente: as funções continuam,
só a leitura/gravação deixa de ser um dict em memória e passa a ser o Postgres.
Diagnóstico ainda é simples (média de desempenho → status); o ML clássico entra depois.
"""
from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone

from . import caminho, chat, credenciais, diagnostico
from . import recomendacoes as rec
from .adaptacao import NIVEIS, estado_inicial_adaptacao, registrar_resposta
from .dados import (
    ALUNOS,
    BANCO,
    CATALOGO,
    DISCIPLINAS,
    HABILIDADES,
    PINS_INICIAIS,
    STATUS_INICIAL,
    TEXTOS,
    TURMA,
    nome_disciplina,
    ordem_caminho,
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
        self.ativas: set[str] = {h["id"] for h in HABILIDADES}
        self.disciplinas_ativas: set[str] = {d["id"] for d in DISCIPLINAS}
        self.sessoes: dict[str, dict] = {}
        self.pins: dict[str, str] = dict(PINS_INICIAIS)
        self.professores: dict[str, dict] = {}              # email -> {nome, senha_hash}
        self.tentativas: dict[str, dict] = {}               # alunoId -> {erros, bloqueadoAte}


estado = Estado()


def _aluno(aluno_id: str) -> dict | None:
    return next((a for a in ALUNOS if a["id"] == aluno_id), None)


# --- Habilidades / status ---------------------------------------------------

_HAB_POR_ID = {h["id"]: h for h in HABILIDADES}
_COM_PERGUNTAS = {p["habilidadeId"] for p in BANCO}


def _status_de(aluno_id: str, habilidade_id: str) -> str | None:
    """Status atual (diagnóstico) ou o inicial da demo; None = habilidade nunca praticada."""
    return estado.status_atual.get(f"{aluno_id}:{habilidade_id}") or STATUS_INICIAL.get(aluno_id, {}).get(habilidade_id)


def _praticadas_na_turma() -> set[str]:
    praticadas = {hid for st in STATUS_INICIAL.values() for hid in st}
    praticadas |= {chave.split(":", 1)[1] for chave in estado.status_atual}
    return praticadas


def habilidades_de(a: dict) -> list[dict]:
    """Colunas da matriz: habilidades ativas que alguém da turma já praticou (com o caminho,
    as que ficam adiante não aparecem até a turma chegar nelas). Todos os alunos recebem as
    mesmas colunas; `iniciada` diz se ESTE aluno já praticou a habilidade."""
    disciplinas_ativas_nomes = {d["nome"] for d in DISCIPLINAS if d["id"] in estado.disciplinas_ativas}
    praticadas = _praticadas_na_turma()
    saida = []
    for h in HABILIDADES:
        if h["id"] in estado.ativas and h["disciplina"] in disciplinas_ativas_nomes and h["id"] in praticadas:
            st = _status_de(a["id"], h["id"])
            saida.append({
                "habilidadeId": h["id"], "nome": h["nome"], "disciplina": h["disciplina"],
                "codigoBncc": h["codigoBncc"], "status": st or "ok", "iniciada": st is not None,
            })
    return saida


def _info_caminho(a: dict, ordem: list[str]) -> caminho.Info:
    return {hid: (_status_de(a["id"], hid), len(_serie(a, hid))) for hid in ordem}


def _ordem_ativa(disciplina_id: str) -> list[str] | None:
    ordem = ordem_caminho(disciplina_id)
    return None if ordem is None else [h for h in ordem if h in estado.ativas]


def caminhos_de(a: dict) -> list[dict]:
    """Progresso do aluno em cada caminho BNCC ativo (disciplinas que já têm caminho)."""
    saida = []
    for d in DISCIPLINAS:
        ordem = _ordem_ativa(d["id"])
        if ordem is None or d["id"] not in estado.disciplinas_ativas:
            continue
        p = caminho.progresso(ordem, _info_caminho(a, ordem))
        saida.append(caminho.formatar_progresso(d["id"], d["nome"], TURMA["ano"], p, _HAB_POR_ID))
    return saida


def _ultima_de(a: dict) -> str | None:
    return estado.ultima_atividade.get(a["id"], a["ultima"])


def resumo(a: dict) -> dict:
    return {
        "id": a["id"],
        "nome": a["nome"],
        "turma": TURMA["nome"],
        "ultimaAtividade": _ultima_de(a),
        "habilidades": habilidades_de(a),
    }


def detalhe(a: dict) -> dict:
    habilidades = habilidades_de(a)
    recomendacoes = []
    for h in habilidades:
        if not h["iniciada"]:
            continue
        if h["status"] == "alerta" or (h["status"] == "atencao" and TEXTOS.get(h["habilidadeId"])):
            recomendacoes.append({
                "habilidadeId": h["habilidadeId"],
                "habilidade": h["nome"],
                "status": h["status"],
                "texto": rec.texto_para(h["habilidadeId"], h["nome"], h["disciplina"], h["status"]),
                "geradaEm": _ultima_de(a) or "2026-10-13",
            })
    return {**resumo(a), "recomendacoes": recomendacoes, "caminhos": caminhos_de(a)}


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
            status = STATUS_INICIAL[a["id"]].get(h["id"])
            if status is None:
                continue  # ainda não praticada na demo: sem histórico
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
        for h in habilidades_de(a)
        if h["iniciada"]
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

def habilidade_config(h: dict, ativas: set[str]) -> dict:
    return {
        "id": h["id"], "nome": h["nome"], "descricao": h["descricao"],
        "ativa": h["avaliavel"] and h["id"] in ativas,
        "codigoBncc": h["codigoBncc"], "unidade": h["unidade"], "avaliavel": h["avaliavel"],
    }


def config() -> dict:
    ordem = ["mat", "por", "geo", "cie", "ing"]  # painel: Matemática e Português primeiro
    disciplinas = []
    for did in ordem:
        nome = nome_disciplina(did)
        disciplinas.append({
            "id": did,
            "nome": nome,
            "ativa": did in estado.disciplinas_ativas,
            "caminhoBncc": ordem_caminho(did) is not None,
            "habilidades": [habilidade_config(h, estado.ativas) for h in CATALOGO if h["disciplina"] == nome],
        })
    return {"turma": TURMA, "ciclo": "4º bimestre de 2026", "disciplinas": disciplinas}


# --- Sessão / perguntas -----------------------------------------------------

def _habilidades_da_sessao(disciplina_id: str | None, aluno: dict | None = None) -> list[str]:
    """Habilidades ativas e com perguntas. Em disciplina com caminho BNCC, e sabendo o aluno,
    restringe à frente do caminho dele (próximas pendentes + uma revisão em alerta)."""
    ids = []
    for d in DISCIPLINAS:
        if d["id"] not in estado.disciplinas_ativas or (disciplina_id and d["id"] != disciplina_id):
            continue
        habs = [h["id"] for h in HABILIDADES
                if h["disciplina"] == d["nome"] and h["id"] in estado.ativas and h["id"] in _COM_PERGUNTAS]
        if aluno is not None and ordem_caminho(d["id"]) is not None:
            habs = caminho.frente(habs, _info_caminho(aluno, habs))
        ids.extend(habs)
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
    return {"valido": True, "acesso": credenciais.emitir(aluno_id), "bloqueado": False}


def regenerar_pin(aluno_id: str) -> dict:
    aluno = _aluno(aluno_id)
    if not aluno:
        raise ApiErro(404, "Aluno não encontrado")
    estado.pins[aluno["id"]] = _novo_pin(estado.pins.get(aluno["id"]))
    estado.tentativas.pop(aluno["id"], None)
    # O PIN antigo deixa de valer, inclusive para quem já tinha entrado com ele.
    credenciais.revogar_aluno(aluno["id"])
    return cadastro(aluno)


# --- Chat -------------------------------------------------------------------

def _retrato_turma() -> chat.RetratoTurma:
    por_aluno = [{"a": a, "habilidades": habilidades_de(a)} for a in ALUNOS]
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
    estado.ativas = set(habilidades_ativas) & set(_HAB_POR_ID)  # "em sala" não entram no quiz
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


def aluno_do_acesso(acesso: str) -> str | None:
    """De quem é esta credencial de PIN (None se não existe, venceu ou foi revogada)."""
    return credenciais.dono(acesso)


# --- Conta do professor (o hash vem pronto de seguranca.py) -------------------

def professor_por_email(email: str) -> dict | None:
    p = estado.professores.get(email)
    return {"email": email, **p} if p else None


def salvar_professor(email: str, nome: str, senha_hash: str) -> None:
    estado.professores[email] = {"nome": nome, "senha_hash": senha_hash}


def iniciar_sessao(codigo: str, aluno_id: str, acesso: str | None, disciplina_id: str | None) -> dict:
    # Sem a credencial do PIN, ninguém abre sessão em nome de outro aluno.
    if credenciais.dono(acesso) != aluno_id:
        raise ApiErro(401, "Confirme o PIN do aluno antes de começar")
    habilidades = _habilidades_da_sessao(disciplina_id, _aluno(aluno_id))
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
    sessao_id = credenciais.novo_id_sessao()
    estado.sessoes[sessao_id] = {
        "acertos": 0,
        "alunoId": aluno_id,
        "total": len(perguntas),
        "habilidades": habilidades,
        "usadas": {perguntas[0]["id"]},
        "servidas": {p["id"] for p in perguntas},
        "adaptacao": adaptacao,
        "respostas": [],
        "concluida": False,
    }
    return {"sessaoId": sessao_id, "perguntas": [_para_cliente(p) for p in perguntas]}


def responder(sessao_id: str, pergunta_id: str, opcao_id: str) -> dict:
    # Só responde dentro de uma sessão aberta e só perguntas entregues a ela: sem isso,
    # a rota viraria um gabarito aberto de todo o banco.
    s = estado.sessoes.get(sessao_id)
    if not s:
        raise ApiErro(404, "Sessão não encontrada")
    if pergunta_id not in s["servidas"]:
        raise ApiErro(403, "Esta pergunta não faz parte da sessão")
    p = next((q for q in BANCO if q["id"] == pergunta_id), None)
    if not p:
        raise ApiErro(404, "Pergunta não encontrada")
    certa_id = f"{p['id']}-{p['certa']}"
    correta = opcao_id == certa_id
    primeira = not any(q["perguntaId"] == p["id"] for q in s["respostas"])
    if primeira and correta:  # responder de novo não soma estrela
        s["acertos"] += 1
    r = {
        "correta": correta,
        "opcaoCorretaId": certa_id,
        "mensagem": random.choice(ELOGIOS) if correta else f"Quase! A resposta é {p['opcoes'][p['certa']]}.",
    }
    if primeira:
        s["usadas"].add(p["id"])
        s["respostas"].append({"perguntaId": p["id"], "habilidadeId": p["habilidadeId"], "nivel": p["nivel"], "correta": correta})
        s["adaptacao"] = registrar_resposta(s["adaptacao"], correta)
        if len(s["respostas"]) < s["total"]:
            proxima = _escolher_pergunta(s["habilidades"], s["adaptacao"].nivel, s["usadas"], len(s["respostas"]))
            if proxima:
                s["usadas"].add(proxima["id"])
                s["servidas"].add(proxima["id"])
                r["proxima"] = _para_cliente(proxima)
    return r


def concluir_sessao(sessao_id: str) -> dict:
    s = estado.sessoes.get(sessao_id)
    if not s:
        raise ApiErro(404, "Sessão não encontrada")
    if not s["concluida"]:
        s["concluida"] = True
        _registrar_sessao(s)
    acertos = s["acertos"]
    total = s["total"]
    return {
        "estrelas": acertos,
        "total": total,
        "mensagem": "Você chegou ao fim da trilha voando!" if acertos >= total - 1 else "Você chegou ao fim da trilha!",
    }
