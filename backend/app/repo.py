"""Camada de dados sobre o banco (SQLite ou Postgres) — mesma interface pública que app/estado.py.

O main.py escolhe entre estado (memória) e repo (banco) pela presença de DATABASE_URL,
então as funções aqui têm exatamente os mesmos nomes e retornos do estado.py.

O que vem do banco: alunos, PINs, status por habilidade, histórico, config da turma.
O que continua em dados.py: o banco de perguntas (conteúdo do app).
O que fica em memória (transitório): sessão de quiz em andamento, tentativas e acessos de PIN.
Regras puras (escolha de pergunta, pontuação, geração de PIN) são reusadas de estado.py.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, distinct, func, select

from . import bd, caminho, chat, diagnostico
from . import recomendacoes as rec
from .adaptacao import estado_inicial_adaptacao, registrar_resposta
from .dados import BANCO, CATALOGO, DISCIPLINAS, HABILIDADES, TEXTOS, ordem_caminho
from .estado import (  # helpers puros + constantes, reusados para não divergir
    ELOGIOS,
    ESPERA_BLOQUEIO_MS,
    MAX_ERROS_PIN,
    PERGUNTAS_POR_SESSAO,
    PONTOS_RESPOSTA,
    ApiErro,
    _agora_ms,
    _arred,
    _curto,
    _escolher_pergunta,
    _hoje,
    _novo_pin,
    _para_cliente,
    habilidade_config,
)
from .modelos import (
    Aluno,
    AlunoHabilidadeStatus,
    Disciplina,
    Habilidade,
    Historico,
    Turma,
    TurmaDisciplinaAtiva,
    TurmaHabilidadeAtiva,
)
import random

# Estado transitório (não precisa sobreviver a restart).
_sessoes: dict[str, dict] = {}
_acessos: dict[str, str] = {}       # credencial -> aluno_id
_tentativas: dict[str, dict] = {}   # aluno_id -> {erros, bloqueadoAte}


# --- Helpers de leitura -----------------------------------------------------

def _turma(s) -> Turma:
    t = s.execute(select(Turma)).scalars().first()
    if not t:
        raise ApiErro(500, "Banco sem turma. Rode o seed (python -m app.seed).")
    return t


def _contexto(s):
    """Conjuntos ativos + metadados, carregados uma vez por requisição."""
    disc_ativas = {r for (r,) in s.execute(select(TurmaDisciplinaAtiva.disciplina_id))}
    hab_ativas = {r for (r,) in s.execute(select(TurmaHabilidadeAtiva.habilidade_id))}
    disc_nome = {d.id: d.nome for d in s.execute(select(Disciplina)).scalars()}
    habs = list(s.execute(select(Habilidade).order_by(Habilidade.ordem)).scalars())
    return disc_ativas, hab_ativas, disc_nome, habs


def _status_do_aluno(s, aluno_id: str) -> dict[str, str]:
    return {
        r.habilidade_id: r.status
        for r in s.execute(select(AlunoHabilidadeStatus).where(AlunoHabilidadeStatus.aluno_id == aluno_id)).scalars()
    }


_HAB_POR_ID = {h["id"]: h for h in HABILIDADES}
_COM_PERGUNTAS = {p["habilidadeId"] for p in BANCO}


def _praticadas_na_turma(s) -> set[str]:
    return {r for (r,) in s.execute(select(AlunoHabilidadeStatus.habilidade_id).distinct())}


def _habilidades_de(s, aluno_id: str, ctx=None) -> list[dict]:
    """Mesma regra do estado.py: colunas = habilidades ativas que alguém da turma já praticou;
    `iniciada` diz se este aluno já praticou (status ausente = ainda adiante no caminho)."""
    disc_ativas, hab_ativas, disc_nome, habs = ctx or _contexto(s)
    status = _status_do_aluno(s, aluno_id)
    praticadas = _praticadas_na_turma(s)
    saida = []
    for h in habs:
        if h.id in hab_ativas and h.disciplina_id in disc_ativas and h.id in praticadas:
            saida.append({
                "habilidadeId": h.id,
                "nome": h.nome,
                "disciplina": disc_nome[h.disciplina_id],
                "codigoBncc": h.codigo_bncc,
                "status": status.get(h.id, "ok"),
                "iniciada": h.id in status,
            })
    return saida


def _info_caminho(s, aluno_id: str, ordem: list[str]) -> caminho.Info:
    status = _status_do_aluno(s, aluno_id)
    dias = dict(s.execute(
        select(Historico.habilidade_id, func.count(distinct(Historico.data)))
        .where(Historico.aluno_id == aluno_id)
        .group_by(Historico.habilidade_id)
    ).all())
    return {hid: (status.get(hid), dias.get(hid, 0)) for hid in ordem}


def _caminhos(s, aluno_id: str, ctx=None) -> list[dict]:
    disc_ativas, hab_ativas, _, _ = ctx or _contexto(s)
    ano = _turma(s).ano
    saida = []
    for d in DISCIPLINAS:
        ordem = ordem_caminho(d["id"])
        if ordem is None or d["id"] not in disc_ativas:
            continue
        ordem = [h for h in ordem if h in hab_ativas]
        p = caminho.progresso(ordem, _info_caminho(s, aluno_id, ordem))
        saida.append(caminho.formatar_progresso(d["id"], d["nome"], ano, p, _HAB_POR_ID))
    return saida


def _serie(s, aluno_id: str, habilidade_id: str) -> list[dict]:
    rows = s.execute(
        select(Historico.data, Historico.desempenho)
        .where(Historico.aluno_id == aluno_id, Historico.habilidade_id == habilidade_id)
    ).all()
    por_dia: dict[str, list[int]] = {}
    for data, desempenho in rows:
        por_dia.setdefault(data, []).append(desempenho)
    return [
        {"data": data, "desempenho": _arred(sum(vs) / len(vs))}
        for data, vs in sorted(por_dia.items(), key=lambda kv: kv[0])
    ]


def _resumo(s, aluno: Aluno, ctx=None) -> dict:
    turma = _turma(s)
    return {
        "id": aluno.id,
        "nome": aluno.nome,
        "turma": turma.nome,
        "ultimaAtividade": aluno.ultima_atividade,
        "habilidades": _habilidades_de(s, aluno.id, ctx),
    }


def _buscar_aluno(s, aluno_id: str) -> Aluno:
    a = s.get(Aluno, aluno_id)
    if not a:
        raise ApiErro(404, "Aluno não encontrado")
    return a


# --- Operações expostas (mesma assinatura de estado.py) ---------------------

def lista_alunos_resumo() -> list[dict]:
    with bd.SessionLocal() as s:
        ctx = _contexto(s)
        alunos = s.execute(select(Aluno).order_by(Aluno.id)).scalars().all()
        return [_resumo(s, a, ctx) for a in alunos]


def aluno_detalhe(aluno_id: str) -> dict:
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        habilidades = _habilidades_de(s, a.id)
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
                    "geradaEm": a.ultima_atividade or "2026-10-13",
                })
        return {**_resumo(s, a), "recomendacoes": recomendacoes, "caminhos": _caminhos(s, a.id)}


def aluno_historico(aluno_id: str) -> list[dict]:
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        return [
            {"habilidadeId": h["habilidadeId"], "nome": h["nome"], "disciplina": h["disciplina"], "pontos": _serie(s, a.id, h["habilidadeId"])}
            for h in _habilidades_de(s, a.id)
            if h["iniciada"]
        ]


def lista_cadastros() -> list[dict]:
    with bd.SessionLocal() as s:
        alunos = s.execute(select(Aluno).order_by(Aluno.id)).scalars().all()
        return [{"id": a.id, "nome": a.nome, "pin": a.pin} for a in alunos]


def config() -> dict:
    with bd.SessionLocal() as s:
        turma = _turma(s)
        disc_ativas, hab_ativas, _, _ = _contexto(s)
        discs = list(s.execute(select(Disciplina).order_by(Disciplina.ordem)).scalars())
        # Painel: Matemática e Português primeiro, como na demo.
        ordem_painel = ["mat", "por", "geo", "cie", "ing"]
        discs.sort(key=lambda d: ordem_painel.index(d.id) if d.id in ordem_painel else 99)
        disciplinas = []
        for d in discs:
            disciplinas.append({
                "id": d.id,
                "nome": d.nome,
                "ativa": d.id in disc_ativas,
                "caminhoBncc": ordem_caminho(d.id) is not None,
                # Catálogo inteiro (inclui "em sala"); o que está ativo vem do banco.
                "habilidades": [habilidade_config(h, hab_ativas) for h in CATALOGO if h["disciplina"] == d.nome],
            })
        return {"turma": {"id": turma.id, "nome": turma.nome, "codigo": turma.codigo, "ano": turma.ano},
                "ciclo": turma.ciclo, "disciplinas": disciplinas}


def salvar_config(habilidades_ativas: list[str], disciplinas_ativas: list[str] | None) -> dict:
    with bd.SessionLocal() as s:
        turma = _turma(s)
        s.execute(delete(TurmaHabilidadeAtiva))
        for hid in set(habilidades_ativas) & set(_HAB_POR_ID):  # "em sala" não entram no quiz
            s.add(TurmaHabilidadeAtiva(turma_id=turma.id, habilidade_id=hid))
        if disciplinas_ativas is not None:
            s.execute(delete(TurmaDisciplinaAtiva))
            for did in disciplinas_ativas:
                s.add(TurmaDisciplinaAtiva(turma_id=turma.id, disciplina_id=did))
        s.commit()
    return config()


def _habilidades_da_sessao(s, disciplina_id: str | None, aluno_id: str | None = None) -> list[str]:
    """Mesma regra do estado.py: ativas e com perguntas; com caminho BNCC e aluno conhecido,
    só a frente do caminho dele."""
    disc_ativas, hab_ativas, _, habs = _contexto(s)
    ids = []
    for d in DISCIPLINAS:
        if d["id"] not in disc_ativas or (disciplina_id and d["id"] != disciplina_id):
            continue
        da_disc = [h.id for h in habs if h.disciplina_id == d["id"] and h.id in hab_ativas and h.id in _COM_PERGUNTAS]
        if aluno_id is not None and ordem_caminho(d["id"]) is not None:
            da_disc = caminho.frente(da_disc, _info_caminho(s, aluno_id, da_disc))
        ids.extend(da_disc)
    return ids


def turma_publica(codigo: str) -> dict:
    with bd.SessionLocal() as s:
        turma = _turma(s)
        if codigo.upper() != turma.codigo:
            raise ApiErro(404, "Turma não encontrada")
        alunos = s.execute(select(Aluno).order_by(Aluno.id)).scalars().all()
        discs = list(s.execute(select(Disciplina).order_by(Disciplina.ordem)).scalars())
        com_perguntas = []
        for d in discs:
            if len(_habilidades_da_sessao(s, d.id)) > 0:
                com_perguntas.append({"id": d.id, "nome": d.nome})
        return {
            "codigo": turma.codigo,
            "nome": turma.nome,
            "alunos": [{"id": a.id, "nome": _curto(a.nome)} for a in alunos],
            "disciplinas": com_perguntas,
        }


def validar_pin(aluno_id: str, pin: str) -> dict:
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        t = _tentativas.get(aluno_id, {"erros": 0, "bloqueadoAte": 0})
        if t["bloqueadoAte"] > _agora_ms():
            return {"valido": False, "acesso": None, "bloqueado": True}
        if a.pin != pin:
            t["erros"] += 1
            if t["erros"] >= MAX_ERROS_PIN:
                t["erros"] = 0
                t["bloqueadoAte"] = _agora_ms() + ESPERA_BLOQUEIO_MS
            _tentativas[aluno_id] = t
            return {"valido": False, "acesso": None, "bloqueado": t["bloqueadoAte"] > _agora_ms()}
        _tentativas.pop(aluno_id, None)
        acesso = f"acesso-{aluno_id}-{uuid.uuid4()}"
        _acessos[acesso] = aluno_id
        return {"valido": True, "acesso": acesso, "bloqueado": False}


def regenerar_pin(aluno_id: str) -> dict:
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        a.pin = _novo_pin(a.pin)
        s.commit()
        novo = a.pin
    _tentativas.pop(aluno_id, None)
    for acesso in [k for k, v in _acessos.items() if v == aluno_id]:
        _acessos.pop(acesso, None)
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        return {"id": a.id, "nome": a.nome, "pin": novo}


def iniciar_sessao(codigo: str, aluno_id: str, acesso: str | None, disciplina_id: str | None) -> dict:
    if not acesso or _acessos.get(acesso) != aluno_id:
        raise ApiErro(401, "Confirme o PIN do aluno antes de começar")
    with bd.SessionLocal() as s:
        habilidades = _habilidades_da_sessao(s, disciplina_id, aluno_id)
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
    _sessoes[sessao_id] = {
        "acertos": 0, "alunoId": aluno_id, "total": len(perguntas), "habilidades": habilidades,
        "usadas": {perguntas[0]["id"]}, "adaptacao": adaptacao, "respostas": [], "concluida": False,
    }
    return {"sessaoId": sessao_id, "perguntas": [_para_cliente(p) for p in perguntas]}


def responder(sessao_id: str, pergunta_id: str, opcao_id: str) -> dict:
    p = next((q for q in BANCO if q["id"] == pergunta_id), None)
    if not p:
        raise ApiErro(404, "Pergunta não encontrada")
    certa_id = f"{p['id']}-{p['certa']}"
    correta = opcao_id == certa_id
    sess = _sessoes.get(sessao_id)
    if sess and correta:
        sess["acertos"] += 1
    r = {
        "correta": correta,
        "opcaoCorretaId": certa_id,
        "mensagem": random.choice(ELOGIOS) if correta else f"Quase! A resposta é {p['opcoes'][p['certa']]}.",
    }
    if sess and not any(q["perguntaId"] == p["id"] for q in sess["respostas"]):
        sess["usadas"].add(p["id"])
        sess["respostas"].append({"perguntaId": p["id"], "habilidadeId": p["habilidadeId"], "nivel": p["nivel"], "correta": correta})
        sess["adaptacao"] = registrar_resposta(sess["adaptacao"], correta)
        if len(sess["respostas"]) < sess["total"]:
            proxima = _escolher_pergunta(sess["habilidades"], sess["adaptacao"].nivel, sess["usadas"], len(sess["respostas"]))
            if proxima:
                sess["usadas"].add(proxima["id"])
                r["proxima"] = _para_cliente(proxima)
    return r


def concluir_sessao(sessao_id: str) -> dict:
    sess = _sessoes.get(sessao_id)
    if sess and not sess["concluida"]:
        sess["concluida"] = True
        _registrar_sessao(sess)
    acertos = sess["acertos"] if sess else 0
    total = sess["total"] if sess else PERGUNTAS_POR_SESSAO
    return {
        "estrelas": acertos,
        "total": total,
        "mensagem": "Você chegou ao fim da trilha voando!" if acertos >= total - 1 else "Você chegou ao fim da trilha!",
    }


def _registrar_sessao(sess: dict) -> None:
    if len(sess["respostas"]) == 0:
        return
    hoje = _hoje()
    pontos: dict[str, list[int]] = {}
    for r in sess["respostas"]:
        p = PONTOS_RESPOSTA[r["nivel"]]["certa" if r["correta"] else "errada"]
        pontos.setdefault(r["habilidadeId"], []).append(p)
    with bd.SessionLocal() as s:
        a = s.get(Aluno, sess["alunoId"])
        if not a:
            return
        for hid, ps in pontos.items():
            s.add(Historico(aluno_id=a.id, habilidade_id=hid, data=hoje, desempenho=_arred(sum(ps) / len(ps))))
        a.ultima_atividade = hoje
        s.commit()
        # Recalcula status das habilidades tocadas pelo diagnóstico de ML (passo 3).
        for hid in pontos.keys():
            novo = diagnostico.classificar(_serie(s, a.id, hid))
            st = s.get(AlunoHabilidadeStatus, {"aluno_id": a.id, "habilidade_id": hid})
            if st:
                st.status = novo
            else:
                s.add(AlunoHabilidadeStatus(aluno_id=a.id, habilidade_id=hid, status=novo))
        s.commit()


def reavaliar_diagnostico() -> dict:
    """Re-diagnostica todos os alunos a partir do histórico no banco, usando o modelo de ML."""
    atualizados = 0
    with bd.SessionLocal() as s:
        alunos = s.execute(select(Aluno)).scalars().all()
        habs = s.execute(select(Habilidade)).scalars().all()
        for a in alunos:
            for h in habs:
                serie = _serie(s, a.id, h.id)
                if not serie:
                    continue
                novo = diagnostico.classificar(serie)
                st = s.get(AlunoHabilidadeStatus, {"aluno_id": a.id, "habilidade_id": h.id})
                if st:
                    st.status = novo
                else:
                    s.add(AlunoHabilidadeStatus(aluno_id=a.id, habilidade_id=h.id, status=novo))
                atualizados += 1
        s.commit()
    return {"reavaliados": atualizados, "modelo": "ml" if diagnostico.tem_modelo() else "regra"}


def responder_chat_turma(pergunta: str, historico: list[dict] | None = None) -> dict:
    with bd.SessionLocal() as s:
        turma = _turma(s)
        ctx = _contexto(s)
        alunos = s.execute(select(Aluno).order_by(Aluno.id)).scalars().all()
        por_aluno = [{"a": a, "habilidades": _habilidades_de(s, a.id, ctx)} for a in alunos]
        ativas = por_aluno[0]["habilidades"] if por_aluno else []
        semana_passada = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

        def media(ps):
            return sum(p["desempenho"] for p in ps) / max(len(ps), 1)

        evolucao = []
        for a in alunos:
            series = [ser for ser in (_serie(s, a.id, h["habilidadeId"]) for h in ativas) if len(ser) > 1]
            dias = len({p["data"] for ser in series for p in ser})
            if dias > 1:
                inicio = media([p for ser in series for p in ser[:2]])
                fim = media([p for ser in series for p in ser[-2:]])
                evolucao.append({"aluno": _curto(a.nome), "variacao": _arred(fim - inicio)})

        retrato = {
            "turma": turma.nome,
            "habilidades": [
                {
                    "id": h["habilidadeId"], "nome": h["nome"], "disciplina": h["disciplina"],
                    "alerta": [_curto(x["a"].nome) for x in por_aluno if any(y["habilidadeId"] == h["habilidadeId"] and y["status"] == "alerta" for y in x["habilidades"])],
                    "atencao": [_curto(x["a"].nome) for x in por_aluno if any(y["habilidadeId"] == h["habilidadeId"] and y["status"] == "atencao" for y in x["habilidades"])],
                }
                for h in ativas
            ],
            "evolucao": evolucao,
            "semAtividade": [_curto(a.nome) for a in alunos if (a.ultima_atividade or "") < semana_passada],
        }
    texto = chat.responder_llm(pergunta, retrato, historico) or chat.responder_chat(pergunta, retrato)
    return {
        "id": f"m{_agora_ms()}",
        "autor": "assistente",
        "texto": texto,
        "enviadaEm": datetime.now(timezone.utc).isoformat(),
    }
