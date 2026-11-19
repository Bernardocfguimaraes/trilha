from __future__ import annotations

import random
import secrets
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, distinct, func, select

from . import bd, caminho, chat, credenciais, diagnostico, estado, grupos, risco, trilhas
from . import recomendacoes as rec
from .adaptacao import EstadoAdaptacao, estado_inicial_adaptacao, registrar_resposta
from .dados import (
    ANOS_COM_CONTEUDO,
    COM_PERGUNTAS,
    DISCIPLINAS,
    HAB_POR_ID,
    ORDEM_MATRIZ,
    TEXTOS,
    catalogo_do_ano,
    disciplinas_com_conteudo,
    habilidades_do_ano,
    nome_disciplina,
    ordem_caminho,
)
from .modelos import (
    Aluno,
    AlunoHabilidadeStatus,
    Disciplina,
    Habilidade,
    Historico,
    Professor,
    RotuloProfessor,
    Turma,
    TurmaDisciplinaAtiva,
    TurmaHabilidadeAtiva,
)
from .regras import (
    ELOGIOS,
    ESPERA_BLOQUEIO_MS,
    MAX_ERROS_PIN,
    PERGUNTAS_POR_SESSAO,
    PONTOS_RESPOSTA,
    ApiErro,
    agora_ms,
    arred,
    curto,
    escolher_pergunta,
    habilidade_config,
    hoje,
    novo_pin,
    para_cliente,
)

VALIDADE_SESSAO_S = 8 * 60 * 60


def _chave_pin(aluno_id: str) -> str:
    return "pin:" + aluno_id


def _guardar_sessao(sessao_id: str, sess: dict) -> None:
    dados = {**sess, "usadas": sorted(sess["usadas"]), "servidas": sorted(sess["servidas"]), "adaptacao": asdict(sess["adaptacao"])}
    estado.gravar("sessao:" + sessao_id, dados, VALIDADE_SESSAO_S, dono=sess["alunoId"])


def _carregar_sessao(sessao_id: str) -> dict:
    dados = estado.ler("sessao:" + sessao_id)
    if not dados:
        raise ApiErro(404, "Sessão não encontrada")
    return {**dados, "usadas": set(dados["usadas"]), "servidas": set(dados["servidas"]), "adaptacao": EstadoAdaptacao(**dados["adaptacao"])}

_NAO_ENCONTRADA = "Turma não encontrada"


def _turma_do_professor(s, turma_id: str, email: str) -> Turma:
    t = s.get(Turma, turma_id)
    if not t or t.professor_email != email:
        raise ApiErro(404, _NAO_ENCONTRADA)
    return t


def _aluno_do_professor(s, aluno_id: str, email: str) -> tuple[Aluno, Turma]:
    a = s.get(Aluno, aluno_id)
    t = s.get(Turma, a.turma_id) if a else None
    if not a or not t or t.professor_email != email:
        raise ApiErro(404, "Aluno não encontrado")
    return a, t


def _buscar_aluno(s, aluno_id: str) -> Aluno:
    a = s.get(Aluno, aluno_id)
    if not a:
        raise ApiErro(404, "Aluno não encontrado")
    return a


def _contexto(s, turma: Turma):
    disc_ativas = {r for (r,) in s.execute(select(TurmaDisciplinaAtiva.disciplina_id).where(TurmaDisciplinaAtiva.turma_id == turma.id))}
    hab_ativas = {r for (r,) in s.execute(select(TurmaHabilidadeAtiva.habilidade_id).where(TurmaHabilidadeAtiva.turma_id == turma.id))}
    disc_nome = {d["id"]: d["nome"] for d in DISCIPLINAS}
    ids_ano = {h["id"] for h in habilidades_do_ano(turma.ano)}
    habs = [h for h in s.execute(select(Habilidade).order_by(Habilidade.ordem)).scalars() if h.id in ids_ano]
    return disc_ativas, hab_ativas, disc_nome, habs


def _alunos(s, turma: Turma) -> list[Aluno]:
    return list(s.execute(select(Aluno).where(Aluno.turma_id == turma.id).order_by(Aluno.nome)).scalars())


def _status_do_aluno(s, aluno_id: str) -> dict[str, str]:
    return {
        r.habilidade_id: r.status
        for r in s.execute(select(AlunoHabilidadeStatus).where(AlunoHabilidadeStatus.aluno_id == aluno_id)).scalars()
    }


def _praticadas_na_turma(s, turma: Turma) -> set[str]:
    ids = select(Aluno.id).where(Aluno.turma_id == turma.id)
    return {r for (r,) in s.execute(select(AlunoHabilidadeStatus.habilidade_id).where(AlunoHabilidadeStatus.aluno_id.in_(ids)).distinct())}


def _habilidades_de(s, turma: Turma, aluno_id: str, ctx=None) -> list[dict]:
    disc_ativas, hab_ativas, disc_nome, habs = ctx or _contexto(s, turma)
    status = _status_do_aluno(s, aluno_id)
    praticadas = _praticadas_na_turma(s, turma)
    saida = []
    for h in habs:
        if h.id in hab_ativas and h.disciplina_id in disc_ativas and h.id in praticadas:
            st = status.get(h.id, "ok")
            previsao = risco.prever(_serie(s, aluno_id, h.id)) if h.id in status and st != "alerta" else None
            saida.append({
                "habilidadeId": h.id,
                "nome": h.nome,
                "disciplina": disc_nome[h.disciplina_id],
                "codigoBncc": h.codigo_bncc,
                "status": st,
                "iniciada": h.id in status,
                "emRisco": bool(previsao and previsao["emRisco"]),
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


def _caminhos(s, turma: Turma, aluno_id: str, ctx=None) -> list[dict]:
    disc_ativas, hab_ativas, _, _ = ctx or _contexto(s, turma)
    saida = []
    for d in DISCIPLINAS:
        ordem = ordem_caminho(turma.ano, d["id"])
        if ordem is None or d["id"] not in disc_ativas:
            continue
        ordem = [h for h in ordem if h in hab_ativas]
        if not ordem:
            continue
        p = caminho.progresso(ordem, _info_caminho(s, aluno_id, ordem))
        saida.append(caminho.formatar_progresso(d["id"], d["nome"], turma.ano, p, HAB_POR_ID))
    return saida


def _serie(s, aluno_id: str, habilidade_id: str) -> list[dict]:
    rows = s.execute(
        select(Historico.data, Historico.desempenho)
        .where(Historico.aluno_id == aluno_id, Historico.habilidade_id == habilidade_id)
    ).all()
    por_dia: dict[str, list[int]] = {}
    for data, desempenho in rows:
        por_dia.setdefault(data, []).append(desempenho)
    return [{"data": data, "desempenho": arred(sum(vs) / len(vs))} for data, vs in sorted(por_dia.items())]


def _resumo(s, turma: Turma, aluno: Aluno, ctx=None) -> dict:
    return {
        "id": aluno.id,
        "nome": aluno.nome,
        "turma": turma.nome,
        "ultimaAtividade": aluno.ultima_atividade,
        "habilidades": _habilidades_de(s, turma, aluno.id, ctx),
    }


def _detalhe(s, turma: Turma, a: Aluno) -> dict:
    habilidades = _habilidades_de(s, turma, a.id)
    escolhidas = [h for h in habilidades if h["iniciada"] and (
        h["status"] == "alerta" or (h["status"] == "atencao" and TEXTOS.get(h["habilidadeId"])))]
    textos = rec.textos_para([(h["habilidadeId"], h["nome"], h["disciplina"], h["status"]) for h in escolhidas])
    recomendacoes = [{
        "habilidadeId": h["habilidadeId"],
        "habilidade": h["nome"],
        "status": h["status"],
        "texto": texto,
        "geradaEm": a.ultima_atividade or hoje(),
    } for h, texto in zip(escolhidas, textos)]
    return {**_resumo(s, turma, a), "recomendacoes": recomendacoes, "caminhos": _caminhos(s, turma, a.id)}


def _historico(s, turma: Turma, a: Aluno) -> list[dict]:
    return [
        {"habilidadeId": h["habilidadeId"], "nome": h["nome"], "disciplina": h["disciplina"], "pontos": _serie(s, a.id, h["habilidadeId"])}
        for h in _habilidades_de(s, turma, a.id)
        if h["iniciada"]
    ]


def _turma_resumo(s, t: Turma) -> dict:
    n = s.execute(select(func.count()).select_from(Aluno).where(Aluno.turma_id == t.id)).scalar_one()
    return {"id": t.id, "nome": t.nome, "codigo": t.codigo, "ano": t.ano, "alunos": n}


def anos_disponiveis() -> list[dict]:
    return [{"ano": ano, "disciplinas": [nome_disciplina(d) for d in disciplinas_com_conteudo(ano)]} for ano in ANOS_COM_CONTEUDO]


def listar_turmas(email: str) -> list[dict]:
    with bd.SessionLocal() as s:
        turmas = s.execute(select(Turma).where(Turma.professor_email == email).order_by(Turma.ano, Turma.nome)).scalars()
        return [_turma_resumo(s, t) for t in turmas]


_AVES = ["SABIA", "ARARA", "CORUJA", "TUCANO", "GARCA", "PARDAL", "TIE", "CARCARA", "JACU", "SANHACO", "SAIRA", "BEIJA"]
_SUFIXO = "ABCDEFGHJKMNPQRSTUVWXYZ"


def _novo_codigo(s, ano: int) -> str:
    usados = {c for (c,) in s.execute(select(Turma.codigo))}
    aves = random.sample(_AVES, len(_AVES))
    for ave in aves:
        if (c := f"{ave}{ano}") not in usados and len(c) <= 8:
            return c
    while True:
        c = f"{random.choice(aves)[:6]}{ano}{random.choice(_SUFIXO)}"
        if c not in usados and len(c) <= 8:
            return c


def _ativar_tudo(s, turma: Turma) -> None:
    for d in DISCIPLINAS:
        s.add(TurmaDisciplinaAtiva(turma_id=turma.id, disciplina_id=d["id"]))
    for h in habilidades_do_ano(turma.ano):
        s.add(TurmaHabilidadeAtiva(turma_id=turma.id, habilidade_id=h["id"]))


def _cadastrar_aluno(s, turma: Turma, nome: str) -> Aluno:
    a = Aluno(id=f"al{secrets.token_hex(5)}", turma_id=turma.id, nome=nome, pin=novo_pin(), ultima_atividade=None)
    s.add(a)
    return a


def criar_turma(email: str, nome: str, ano: int, nomes_alunos: list[str]) -> dict:
    if ano not in ANOS_COM_CONTEUDO:
        raise ApiErro(422, "Ainda não há atividades para este ano.")
    with bd.SessionLocal() as s:
        t = Turma(id=f"t{secrets.token_hex(5)}", nome=nome.strip(), codigo=_novo_codigo(s, ano),
                  ciclo="4º bimestre de 2026", ano=ano, professor_email=email)
        s.add(t)
        s.flush()
        _ativar_tudo(s, t)
        for n in nomes_alunos:
            _cadastrar_aluno(s, t, n.strip())
        s.commit()
        return _turma_resumo(s, t)


def adicionar_aluno(email: str, turma_id: str, nome: str) -> dict:
    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        a = _cadastrar_aluno(s, t, nome.strip())
        s.commit()
        return {"id": a.id, "nome": a.nome, "pin": a.pin}


def adotar_turmas_orfas(email: str) -> None:
    with bd.SessionLocal() as s:
        donos = {e for (e,) in s.execute(select(Professor.email))}
        for t in s.execute(select(Turma)).scalars():
            if t.professor_email not in donos:
                t.professor_email = email
        s.commit()


def lista_alunos_resumo(email: str, turma_id: str) -> list[dict]:
    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        ctx = _contexto(s, t)
        return [_resumo(s, t, a, ctx) for a in _alunos(s, t)]


def aluno_detalhe(email: str, aluno_id: str) -> dict:
    with bd.SessionLocal() as s:
        a, t = _aluno_do_professor(s, aluno_id, email)
        return _detalhe(s, t, a)


def aluno_historico(email: str, aluno_id: str) -> list[dict]:
    with bd.SessionLocal() as s:
        a, t = _aluno_do_professor(s, aluno_id, email)
        return _historico(s, t, a)


def diagnostico_do_aluno(email: str, aluno_id: str) -> list[dict]:
    with bd.SessionLocal() as s:
        a, t = _aluno_do_professor(s, aluno_id, email)
        rotulos = {r.habilidade_id: r.status for r in s.execute(select(RotuloProfessor).where(RotuloProfessor.aluno_id == a.id)).scalars()}
        saida = []
        for h in _habilidades_de(s, t, a.id):
            if not h["iniciada"]:
                continue
            serie = _serie(s, a.id, h["habilidadeId"])
            if serie:
                explicacao = diagnostico.explicar(serie)
                previsao = risco.prever(serie) if explicacao["status"] != "alerta" else None
                saida.append({"habilidadeId": h["habilidadeId"], "nome": h["nome"], "disciplina": h["disciplina"],
                              **explicacao, "avaliacaoProfessor": rotulos.get(h["habilidadeId"]), "risco": previsao})
        return saida


def avaliar_diagnostico(email: str, aluno_id: str, habilidade_id: str, status: str) -> dict:
    with bd.SessionLocal() as s:
        a, _ = _aluno_do_professor(s, aluno_id, email)
        serie = _serie(s, a.id, habilidade_id)
        if not serie:
            raise ApiErro(404, "Esta habilidade ainda não tem atividades deste aluno")
        modelo = diagnostico.classificar(serie)
        r = s.get(RotuloProfessor, {"aluno_id": a.id, "habilidade_id": habilidade_id})
        if r:
            r.status, r.status_modelo, r.professor_email, r.criado_em = status, modelo, email, hoje()
        else:
            s.add(RotuloProfessor(aluno_id=a.id, habilidade_id=habilidade_id, status=status, status_modelo=modelo,
                                  professor_email=email, criado_em=hoje()))
        s.commit()
        return {"habilidadeId": habilidade_id, "avaliacaoProfessor": status, "statusModelo": modelo}


def dados_reais() -> list[dict]:
    with bd.SessionLocal() as s:
        saida = []
        for r in s.execute(select(RotuloProfessor)).scalars():
            serie = _serie(s, r.aluno_id, r.habilidade_id)
            if serie:
                saida.append({"aluno_id": r.aluno_id, "habilidade_id": r.habilidade_id, "serie": serie, "status": r.status})
        return saida


def concordancia_professores() -> dict:
    amostras = dados_reais()
    acertos = sum(diagnostico.classificar(a["serie"]) == a["status"] for a in amostras)
    return {"avaliacoes": len(amostras), "concordancia": round(acertos / len(amostras), 4) if amostras else None}


def grupos_da_turma(email: str, turma_id: str) -> dict:
    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        disc_ativas, hab_ativas, disc_nome, habs = _contexto(s, t)
        praticadas = _praticadas_na_turma(s, t)
        habilidades = [{"habilidadeId": h.id, "nome": h.nome, "disciplina": disc_nome[h.disciplina_id]}
                       for h in habs if h.id in praticadas and h.id in hab_ativas and h.disciplina_id in disc_ativas]
        alunos = []
        for a in _alunos(s, t):
            recentes = {}
            for h in habilidades:
                serie = _serie(s, a.id, h["habilidadeId"])
                if serie:
                    ultimos = [p["desempenho"] for p in serie[-3:]]
                    recentes[h["habilidadeId"]] = sum(ultimos) / len(ultimos)
            alunos.append({"id": a.id, "nome": a.nome, "recentes": recentes})
    return {"turma": t.nome, **grupos.formar_grupos(alunos, habilidades)}


_ROTULO = {"ok": "Ok", "atencao": "Atenção", "alerta": "Alerta"}


def relatorio_turma_csv(email: str, turma_id: str) -> tuple[str, str]:
    import csv
    import io

    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        ctx = _contexto(s, t)
        saida = io.StringIO()
        w = csv.writer(saida, delimiter=";", lineterminator="\r\n")
        w.writerow(["Aluno", "Disciplina", "Habilidade", "Código BNCC", "Status", "Confiança do modelo",
                    "Pode cair para alerta", "Dias com atividade", "Última atividade"])
        for a in _alunos(s, t):
            linhas = [(h, serie) for h in _habilidades_de(s, t, a.id, ctx) if h["iniciada"]
                      for serie in [_serie(s, a.id, h["habilidadeId"])] if serie]
            if not linhas:
                w.writerow([a.nome, "", "", "", "Sem atividades", "", "", "0", ""])
                continue
            for h, serie in linhas:
                probs = diagnostico.probabilidades(serie)
                confianca = f"{round(max(probs.values()) * 100)}%" if probs else ""
                w.writerow([a.nome, h["disciplina"], h["nome"], h["codigoBncc"] or "", _ROTULO[h["status"]], confianca,
                            "Sim" if h["emRisco"] else "Não", str(len(serie)), a.ultima_atividade or ""])
        nome = f"trilha-{t.nome.lower().replace(' ', '-').replace('º', '')}-{hoje()}.csv"
        return nome, "﻿" + saida.getvalue()


def progresso_do_aluno(aluno_id: str) -> dict:
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        t = s.get(Turma, a.turma_id)
        return {"aluno": _detalhe(s, t, a), "historico": _historico(s, t, a)}


def lista_cadastros(email: str, turma_id: str) -> list[dict]:
    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        return [{"id": a.id, "nome": a.nome, "pin": a.pin} for a in _alunos(s, t)]


def _config(s, t: Turma) -> dict:
    disc_ativas, hab_ativas, _, _ = _contexto(s, t)
    catalogo = catalogo_do_ano(t.ano)
    com_conteudo = set(disciplinas_com_conteudo(t.ano))
    disciplinas = []
    for did in ORDEM_MATRIZ:
        if did not in com_conteudo:
            continue
        nome = nome_disciplina(did)
        disciplinas.append({
            "id": did,
            "nome": nome,
            "ativa": did in disc_ativas,
            "caminhoBncc": ordem_caminho(t.ano, did) is not None,
            "habilidades": [habilidade_config(h, hab_ativas) for h in catalogo if h["disciplina"] == nome],
        })
    return {"turma": {"id": t.id, "nome": t.nome, "codigo": t.codigo, "ano": t.ano},
            "ciclo": t.ciclo, "disciplinas": disciplinas}


def config(email: str, turma_id: str) -> dict:
    with bd.SessionLocal() as s:
        return _config(s, _turma_do_professor(s, turma_id, email))


def salvar_config(email: str, turma_id: str, habilidades_ativas: list[str], disciplinas_ativas: list[str] | None) -> dict:
    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        validas = {h["id"] for h in habilidades_do_ano(t.ano)}
        s.execute(delete(TurmaHabilidadeAtiva).where(TurmaHabilidadeAtiva.turma_id == t.id))
        for hid in set(habilidades_ativas) & validas:
            s.add(TurmaHabilidadeAtiva(turma_id=t.id, habilidade_id=hid))
        if disciplinas_ativas is not None:
            s.execute(delete(TurmaDisciplinaAtiva).where(TurmaDisciplinaAtiva.turma_id == t.id))
            for did in set(disciplinas_ativas) & {d["id"] for d in DISCIPLINAS}:
                s.add(TurmaDisciplinaAtiva(turma_id=t.id, disciplina_id=did))
        s.commit()
        return _config(s, t)


def regenerar_pin(email: str, aluno_id: str) -> dict:
    with bd.SessionLocal() as s:
        a, _ = _aluno_do_professor(s, aluno_id, email)
        a.pin = novo_pin(a.pin)
        s.commit()
        resposta = {"id": a.id, "nome": a.nome, "pin": a.pin}
    estado.apagar(_chave_pin(aluno_id))
    credenciais.revogar_aluno(aluno_id)
    return resposta


def reavaliar_diagnostico(email: str, turma_id: str) -> dict:
    atualizados = 0
    with bd.SessionLocal() as s:
        t = _turma_do_professor(s, turma_id, email)
        ids_ano = [h["id"] for h in habilidades_do_ano(t.ano)]
        for a in _alunos(s, t):
            for hid in ids_ano:
                serie = _serie(s, a.id, hid)
                if not serie:
                    continue
                novo = diagnostico.classificar(serie)
                st = s.get(AlunoHabilidadeStatus, {"aluno_id": a.id, "habilidade_id": hid})
                if st:
                    st.status = novo
                else:
                    s.add(AlunoHabilidadeStatus(aluno_id=a.id, habilidade_id=hid, status=novo))
                atualizados += 1
        s.commit()
    return {"reavaliados": atualizados, "modelo": "ml" if diagnostico.tem_modelo() else "regra"}


def responder_chat_turma(email: str, turma_id: str, pergunta: str, historico: list[dict] | None = None) -> dict:
    with bd.SessionLocal() as s:
        turma = _turma_do_professor(s, turma_id, email)
        ctx = _contexto(s, turma)
        alunos = _alunos(s, turma)
        por_aluno = [{"a": a, "habilidades": _habilidades_de(s, turma, a.id, ctx)} for a in alunos]
        ativas = por_aluno[0]["habilidades"] if por_aluno else []
        semana_passada = (date.fromisoformat(hoje()) - timedelta(days=7)).isoformat()

        def media(ps):
            return sum(p["desempenho"] for p in ps) / max(len(ps), 1)

        evolucao = []
        for a in alunos:
            series = [ser for ser in (_serie(s, a.id, h["habilidadeId"]) for h in ativas) if len(ser) > 1]
            dias = len({p["data"] for ser in series for p in ser})
            if dias > 1:
                inicio = media([p for ser in series for p in ser[:2]])
                fim = media([p for ser in series for p in ser[-2:]])
                evolucao.append({"aluno": curto(a.nome), "variacao": arred(fim - inicio)})

        retrato = {
            "turma": turma.nome,
            "habilidades": [
                {
                    "id": h["habilidadeId"], "nome": h["nome"], "disciplina": h["disciplina"],
                    "alerta": [curto(x["a"].nome) for x in por_aluno if any(y["habilidadeId"] == h["habilidadeId"] and y["status"] == "alerta" for y in x["habilidades"])],
                    "atencao": [curto(x["a"].nome) for x in por_aluno if any(y["habilidadeId"] == h["habilidadeId"] and y["status"] == "atencao" for y in x["habilidades"])],
                }
                for h in ativas
            ],
            "evolucao": evolucao,
            "semAtividade": [curto(a.nome) for a in alunos if (a.ultima_atividade or "") < semana_passada],
        }
    texto = chat.responder_llm(pergunta, retrato, historico) or chat.responder_chat(pergunta, retrato)
    return {"id": f"m{agora_ms()}", "autor": "assistente", "texto": texto, "enviadaEm": datetime.now(timezone.utc).isoformat()}


def _habilidades_da_sessao(s, turma: Turma, disciplina_id: str | None, aluno_id: str | None = None) -> list[str]:
    disc_ativas, hab_ativas, _, habs = _contexto(s, turma)
    com_perguntas = COM_PERGUNTAS | trilhas.habilidades_com_perguntas_da_turma(s, turma.id)
    ids = []
    for d in DISCIPLINAS:
        if d["id"] not in disc_ativas or (disciplina_id and d["id"] != disciplina_id):
            continue
        da_disc = [h.id for h in habs if h.disciplina_id == d["id"] and h.id in hab_ativas and h.id in com_perguntas]
        if aluno_id is not None and ordem_caminho(turma.ano, d["id"]) is not None:
            da_disc = caminho.frente(da_disc, _info_caminho(s, aluno_id, da_disc))
        ids.extend(da_disc)
    return ids


def _turma_por_codigo(s, codigo: str) -> Turma:
    t = s.execute(select(Turma).where(Turma.codigo == codigo.strip().upper())).scalars().first()
    if not t:
        raise ApiErro(404, _NAO_ENCONTRADA)
    return t


def turma_publica(codigo: str) -> dict:
    with bd.SessionLocal() as s:
        t = _turma_por_codigo(s, codigo)
        semanais = trilhas.publicas(s, t)
        com_trilha = {x["disciplinaId"] for x in semanais}
        disciplinas = [{"id": d["id"], "nome": d["nome"]} for d in DISCIPLINAS
                       if d["id"] in com_trilha or _habilidades_da_sessao(s, t, d["id"])]
        return {
            "codigo": t.codigo,
            "nome": t.nome,
            "alunos": [{"id": a.id, "nome": curto(a.nome)} for a in _alunos(s, t)],
            "disciplinas": disciplinas,
            "trilhas": semanais,
        }


def validar_pin(aluno_id: str, pin: str) -> dict:
    with bd.SessionLocal() as s:
        a = _buscar_aluno(s, aluno_id)
        t = estado.ler(_chave_pin(aluno_id)) or {"erros": 0, "bloqueadoAte": 0}
        if t["bloqueadoAte"] > agora_ms():
            return {"valido": False, "acesso": None, "bloqueado": True}
        if a.pin != pin:
            t["erros"] += 1
            if t["erros"] >= MAX_ERROS_PIN:
                t["erros"] = 0
                t["bloqueadoAte"] = agora_ms() + ESPERA_BLOQUEIO_MS
            estado.gravar(_chave_pin(aluno_id), t, ESPERA_BLOQUEIO_MS / 1000 + 3600)
            return {"valido": False, "acesso": None, "bloqueado": t["bloqueadoAte"] > agora_ms()}
        estado.apagar(_chave_pin(aluno_id))
        turma = s.get(Turma, a.turma_id)
        feitas = trilhas.feitas_por(s, a.id, [x.id for x in trilhas.disponiveis(s, turma)]) if turma else []
        return {"valido": True, "acesso": credenciais.emitir(aluno_id), "bloqueado": False, "trilhasFeitas": feitas}


def aluno_do_acesso(acesso: str) -> str | None:
    return credenciais.dono(acesso)


MODOS_SESSAO = ("normal", "semana", "revisao", "praticar")


def iniciar_sessao(codigo: str, aluno_id: str, acesso: str | None, disciplina_id: str | None,
                   trilha_id: str | None = None, modo: str = "normal") -> dict:
    if credenciais.dono(acesso) != aluno_id:
        raise ApiErro(401, "Confirme o PIN do aluno antes de começar")
    if modo not in MODOS_SESSAO or (modo != "normal" and not trilha_id):
        raise ApiErro(422, "Modo de trilha inválido")
    fixas: list[dict] = []
    with bd.SessionLocal() as s:
        t = _turma_por_codigo(s, codigo)
        if _buscar_aluno(s, aluno_id).turma_id != t.id:
            raise ApiErro(404, "Aluno não encontrado nesta turma")
        if modo == "normal":
            habilidades = _habilidades_da_sessao(s, t, disciplina_id, aluno_id)
            extras = trilhas.perguntas_extras(s, t.id, habilidades)
        else:
            semanal = trilhas.trilha_disponivel(s, t, trilha_id)
            habilidades = trilhas.habilidades_da_trilha(s, semanal)
            extras = trilhas.perguntas_extras(s, t.id, habilidades)
            if modo in ("semana", "revisao"):
                fixas = trilhas.perguntas_da_trilha(s, semanal)
    if not fixas and len(habilidades) == 0:
        raise ApiErro(404, "Nenhuma habilidade ativa nesta disciplina")
    adaptacao = estado_inicial_adaptacao()
    if fixas:
        perguntas = random.sample(fixas, len(fixas))
    else:
        reservadas: set[str] = set()
        perguntas = []
        for i in range(PERGUNTAS_POR_SESSAO):
            p = escolher_pergunta(habilidades, adaptacao.nivel, reservadas, i, extras)
            if not p:
                break
            reservadas.add(p["id"])
            perguntas.append(p)
    if not perguntas:
        raise ApiErro(404, "Ainda não há perguntas para esta trilha")
    sessao_id = credenciais.novo_id_sessao()
    _guardar_sessao(sessao_id, {
        "acertos": 0, "alunoId": aluno_id, "total": len(perguntas), "habilidades": habilidades,
        "usadas": {perguntas[0]["id"]}, "servidas": {p["id"] for p in perguntas}, "adaptacao": adaptacao,
        "respostas": [], "concluida": False, "turmaId": t.id, "trilhaId": trilha_id if modo != "normal" else None,
        "modo": modo, "fixa": bool(fixas),
    })
    return {"sessaoId": sessao_id, "perguntas": [para_cliente(p) for p in perguntas]}


def responder(sessao_id: str, pergunta_id: str, opcao_id: str) -> dict:
    sess = _carregar_sessao(sessao_id)
    if pergunta_id not in sess["servidas"]:
        raise ApiErro(403, "Esta pergunta não faz parte da sessão")
    with bd.SessionLocal() as s:
        p = trilhas.pergunta_servida(s, pergunta_id, sess.get("turmaId"))
        extras = trilhas.perguntas_extras(s, sess["turmaId"], sess["habilidades"]) if sess.get("turmaId") and not sess.get("fixa") else []
    if not p:
        raise ApiErro(404, "Pergunta não encontrada")
    certa_id = f"{p['id']}-{p['certa']}"
    correta = opcao_id == certa_id
    primeira = not any(q["perguntaId"] == p["id"] for q in sess["respostas"])
    if primeira and correta:
        sess["acertos"] += 1
    r = {
        "correta": correta,
        "opcaoCorretaId": certa_id,
        "mensagem": random.choice(ELOGIOS) if correta else f"Quase! A resposta é {p['opcoes'][p['certa']]}.",
    }
    if primeira:
        sess["usadas"].add(p["id"])
        sess["respostas"].append({"perguntaId": p["id"], "habilidadeId": p["habilidadeId"], "nivel": p["nivel"], "correta": correta})
        sess["adaptacao"] = registrar_resposta(sess["adaptacao"], correta)
        if len(sess["respostas"]) < sess["total"] and not sess.get("fixa"):
            proxima = escolher_pergunta(sess["habilidades"], sess["adaptacao"].nivel, sess["usadas"], len(sess["respostas"]), extras)
            if proxima:
                sess["usadas"].add(proxima["id"])
                sess["servidas"].add(proxima["id"])
                r["proxima"] = para_cliente(proxima)
        _guardar_sessao(sessao_id, sess)
    return r


def concluir_sessao(sessao_id: str) -> dict:
    sess = _carregar_sessao(sessao_id)
    if not sess["concluida"]:
        sess["concluida"] = True
        _guardar_sessao(sessao_id, sess)
        _registrar_sessao(sess)
        if sess.get("modo") == "semana" and sess.get("trilhaId") and sess["respostas"]:
            trilhas.registrar_conclusao(sess["trilhaId"], sess["alunoId"], sess["acertos"], sess["total"])
    acertos, total = sess["acertos"], sess["total"]
    return {
        "estrelas": acertos,
        "total": total,
        "mensagem": "Você chegou ao fim da trilha voando!" if acertos >= total - 1 else "Você chegou ao fim da trilha!",
        "trilhaId": sess.get("trilhaId"),
    }


def _registrar_sessao(sess: dict) -> None:
    if len(sess["respostas"]) == 0:
        return
    dia = hoje()
    pontos: dict[str, list[int]] = {}
    for r in sess["respostas"]:
        pontos.setdefault(r["habilidadeId"], []).append(PONTOS_RESPOSTA[r["nivel"]]["certa" if r["correta"] else "errada"])
    with bd.SessionLocal() as s:
        a = s.get(Aluno, sess["alunoId"])
        if not a:
            return
        for hid, ps in pontos.items():
            s.add(Historico(aluno_id=a.id, habilidade_id=hid, data=dia, desempenho=arred(sum(ps) / len(ps))))
        a.ultima_atividade = dia
        s.commit()
        for hid in pontos:
            novo = diagnostico.classificar(_serie(s, a.id, hid))
            st = s.get(AlunoHabilidadeStatus, {"aluno_id": a.id, "habilidade_id": hid})
            if st:
                st.status = novo
            else:
                s.add(AlunoHabilidadeStatus(aluno_id=a.id, habilidade_id=hid, status=novo))
        s.commit()


def professor_por_email(email: str) -> dict | None:
    with bd.SessionLocal() as s:
        p = s.get(Professor, email)
        return {"email": p.email, "nome": p.nome, "senha_hash": p.senha_hash} if p else None


def salvar_professor(email: str, nome: str, senha_hash: str) -> None:
    with bd.SessionLocal() as s:
        p = s.get(Professor, email)
        if p:
            p.nome, p.senha_hash = nome, senha_hash
        else:
            s.add(Professor(email=email, nome=nome, senha_hash=senha_hash))
        s.commit()
