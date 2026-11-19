from __future__ import annotations

import hashlib
import json
import random
import re
import secrets
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, func, select

from . import bd, exercicios
from .adaptacao import NIVEIS
from .dados import BANCO, COM_PERGUNTAS, DISCIPLINAS, HAB_POR_ID, ORDEM_MATRIZ, catalogo_do_ano, disciplinas_com_conteudo, nome_disciplina
from .modelos import Aluno, PerguntaTurma, Trilha, TrilhaConclusao, Turma, TurmaDisciplinaAtiva, TurmaHabilidadeAtiva
from .regras import ApiErro, hoje

TIPOS = ("escolha", "lacuna")
MAX_PERGUNTAS_TRILHA = 20
MAX_DIAS = 60
MAX_RASCUNHOS_IA = 6
_BURACO = re.compile(r"_{2,}")
_BANCO_POR_ID = {p["id"]: p for p in BANCO}


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def _turma(s, turma_id: str, email: str) -> Turma:
    t = s.get(Turma, turma_id)
    if not t or t.professor_email != email:
        raise ApiErro(404, "Turma não encontrada")
    return t


def _da_turma(s, modelo, item_id: str, email: str, nao_achou: str):
    item = s.get(modelo, item_id)
    t = s.get(Turma, item.turma_id) if item else None
    if not item or not t or t.professor_email != email:
        raise ApiErro(404, nao_achou)
    return item, t


def _habilidades_validas(turma: Turma) -> dict[str, dict]:
    return {h["id"]: h for h in catalogo_do_ano(turma.ano) if h["avaliavel"]}


def _disciplina_id(nome: str) -> str | None:
    return next((d["id"] for d in DISCIPLINAS if d["nome"] == nome), None)


def _embaralhar(p: dict) -> dict:
    ordem = list(range(len(p["opcoes"])))
    random.Random(hashlib.sha256(p["id"].encode()).hexdigest()).shuffle(ordem)
    return {**p, "opcoes": [p["opcoes"][i] for i in ordem], "certa": ordem.index(p["certa"])}


def tipo_do_enunciado(enunciado: str) -> str:
    return "lacuna" if _BURACO.search(enunciado) else "escolha"


def _habilidade_info(hid: str) -> dict:
    h = HAB_POR_ID.get(hid, {})
    return {"id": hid, "nome": h.get("nome", hid), "codigoBncc": h.get("codigoBncc"), "unidade": h.get("unidade")}


def _pergunta_professor(p: PerguntaTurma) -> dict:
    return {
        "id": p.id,
        "habilidade": _habilidade_info(p.habilidade_id),
        "nivel": p.nivel,
        "tipo": p.tipo,
        "enunciado": p.enunciado,
        "instrucao": p.instrucao,
        "frase": p.frase,
        "opcoes": json.loads(p.opcoes),
        "certa": p.certa,
        "explicacao": p.explicacao or "",
        "origem": p.origem,
        "revisao": json.loads(p.revisao) if p.revisao else None,
        "criadaEm": p.criada_em,
    }


def _banco_professor(q: dict) -> dict:
    return {
        "id": q["id"],
        "habilidade": _habilidade_info(q["habilidadeId"]),
        "nivel": q["nivel"],
        "tipo": tipo_do_enunciado(q["enunciado"]),
        "enunciado": q["enunciado"],
        "instrucao": None,
        "frase": None,
        "opcoes": list(q["opcoes"]),
        "certa": q["certa"],
        "explicacao": q.get("explicacao") or "",
        "origem": "banco",
        "revisao": None,
        "criadaEm": None,
    }


def _servir(p: PerguntaTurma) -> dict:
    return _embaralhar({
        "id": p.id,
        "habilidadeId": p.habilidade_id,
        "nivel": p.nivel,
        "enunciado": p.enunciado,
        "apoio": None,
        "opcoes": json.loads(p.opcoes),
        "certa": p.certa,
        "explicacao": p.explicacao or "",
        "origem": "professora",
    })


def _limpo(valor, limite: int) -> str:
    return re.sub(r"\s+", " ", str(valor or "")).strip()[:limite]


def _montar_pergunta(turma: Turma, dados: dict) -> tuple[dict, list[str]]:
    tipo = dados.get("tipo")
    if tipo not in TIPOS:
        raise ApiErro(422, "Escolha o tipo: múltipla escolha ou completar a frase")
    hid = dados.get("habilidadeId")
    if hid not in _habilidades_validas(turma):
        raise ApiErro(422, "Escolha uma habilidade da BNCC do ano desta turma")
    nivel = dados.get("nivel")
    if nivel not in NIVEIS:
        raise ApiErro(422, "Escolha o nível: fácil, médio ou difícil")
    opcoes = [_limpo(o, 160) for o in (dados.get("opcoes") or [])]
    certa = dados.get("certa")
    explicacao = _limpo(dados.get("explicacao"), 400)
    avisos: list[str] = []
    if any(not o for o in opcoes):
        raise ApiErro(422, "Preencha todas as alternativas")
    if len({o.lower() for o in opcoes}) != len(opcoes):
        raise ApiErro(422, "As alternativas precisam ser diferentes entre si")
    if not isinstance(certa, int) or isinstance(certa, bool) or not 0 <= certa < len(opcoes):
        raise ApiErro(422, "Marque qual alternativa é a certa")

    if tipo == "escolha":
        enunciado = _limpo(dados.get("enunciado"), 700)
        if len(enunciado) < 5:
            raise ApiErro(422, "Escreva o enunciado da pergunta")
        if len(opcoes) != 4:
            raise ApiErro(422, "Uma pergunta de múltipla escolha tem 4 alternativas")
        instrucao = frase = None
        if exercicios._entrega_pelo_tamanho(opcoes, certa):
            avisos.append("A alternativa certa é bem mais longa que as outras: o aluno pode acertar só pelo tamanho.")
        if exercicios._tem_opcoes_equivalentes(opcoes):
            avisos.append("Há duas alternativas com o mesmo valor (por exemplo, 1/2 e 0,5).")
        if "?" not in enunciado and not enunciado.endswith(":"):
            avisos.append("O enunciado não termina com uma pergunta ou com dois-pontos.")
    else:
        frase = _limpo(dados.get("frase"), 300).replace('"', "'")
        instrucao = _limpo(dados.get("instrucao"), 160).replace('"', "'").rstrip(":. ") or None
        buracos = len(_BURACO.split(frase)) - 1
        if not 1 <= buracos <= 3:
            raise ApiErro(422, "Marque na frase o lugar da resposta com ___ (de 1 a 3 lacunas)")
        if not 2 <= len(opcoes) <= 4:
            raise ApiErro(422, "Completar a frase tem de 2 a 4 peças")
        if buracos > 1 and any(len([x for x in o.split(" / ") if x.strip()]) != buracos for o in opcoes):
            raise ApiErro(422, f"Com {buracos} lacunas, cada peça tem {buracos} partes separadas por ' / '")
        enunciado = f'{instrucao or "Complete a frase"}: "{frase}"'

    return {
        "tipo": tipo, "habilidade_id": hid, "nivel": nivel, "enunciado": enunciado, "instrucao": instrucao,
        "frase": frase, "opcoes": json.dumps(opcoes, ensure_ascii=False), "certa": certa, "explicacao": explicacao,
    }, avisos


def listar_perguntas(email: str, turma_id: str, habilidades: list[str] | None = None) -> list[dict]:
    with bd.SessionLocal() as s:
        _turma(s, turma_id, email)
        consulta = select(PerguntaTurma).where(PerguntaTurma.turma_id == turma_id).order_by(PerguntaTurma.criada_em.desc())
        if habilidades:
            consulta = consulta.where(PerguntaTurma.habilidade_id.in_(habilidades))
        return [_pergunta_professor(p) for p in s.execute(consulta).scalars()]


def criar_pergunta(email: str, turma_id: str, dados: dict, origem: str = "professora", revisao: dict | None = None) -> dict:
    with bd.SessionLocal() as s:
        t = _turma(s, turma_id, email)
        campos, avisos = _montar_pergunta(t, dados)
        p = PerguntaTurma(id="pt" + secrets.token_urlsafe(9), turma_id=t.id, origem=origem if origem in ("professora", "ia") else "professora",
                          revisao=json.dumps(revisao, ensure_ascii=False) if revisao else None, autor_email=email, criada_em=_agora(), **campos)
        s.add(p)
        s.commit()
        return {"pergunta": _pergunta_professor(p), "avisos": avisos}


def editar_pergunta(email: str, pergunta_id: str, dados: dict) -> dict:
    with bd.SessionLocal() as s:
        p, t = _da_turma(s, PerguntaTurma, pergunta_id, email, "Pergunta não encontrada")
        campos, avisos = _montar_pergunta(t, dados)
        mudou = any(getattr(p, k) != v for k, v in campos.items())
        for k, v in campos.items():
            setattr(p, k, v)
        if mudou:
            p.revisao = None
        s.commit()
        return {"pergunta": _pergunta_professor(p), "avisos": avisos}


def _trilhas_com_pergunta(s, turma_id: str, pergunta_id: str) -> list[Trilha]:
    return [t for t in s.execute(select(Trilha).where(Trilha.turma_id == turma_id)).scalars() if pergunta_id in json.loads(t.perguntas)]


def excluir_pergunta(email: str, pergunta_id: str) -> dict:
    with bd.SessionLocal() as s:
        p, t = _da_turma(s, PerguntaTurma, pergunta_id, email, "Pergunta não encontrada")
        usadas = _trilhas_com_pergunta(s, t.id, p.id)
        if any(situacao(tr) == "lancada" for tr in usadas):
            raise ApiErro(409, "Esta pergunta está numa trilha lançada. Tire a pergunta da trilha ou encerre a trilha antes.")
        for tr in usadas:
            tr.perguntas = json.dumps([x for x in json.loads(tr.perguntas) if x != p.id])
        s.delete(p)
        s.commit()
        return {"ok": True}


def revisar_pergunta(email: str, pergunta_id: str) -> dict:
    with bd.SessionLocal() as s:
        p, _ = _da_turma(s, PerguntaTurma, pergunta_id, email, "Pergunta não encontrada")
        q = {"enunciado": p.enunciado, "opcoes": json.loads(p.opcoes), "indiceCorreta": p.certa}
        resultado = exercicios.revisar_uma(p.habilidade_id, q)
        if resultado is None:
            raise ApiErro(503, "A revisão da IA não está disponível agora. Tente de novo em alguns instantes.")
        p.revisao = json.dumps(resultado, ensure_ascii=False)
        s.commit()
        return _pergunta_professor(p)


def gerar_rascunhos(email: str, turma_id: str, dados: dict) -> dict:
    with bd.SessionLocal() as s:
        t = _turma(s, turma_id, email)
        hid = dados.get("habilidadeId")
        if hid not in _habilidades_validas(t):
            raise ApiErro(422, "Escolha uma habilidade da BNCC do ano desta turma")
    descricao = _limpo(dados.get("descricao"), 600)
    if len(descricao) < 10:
        raise ApiErro(422, "Conte em poucas palavras o que foi trabalhado na aula")
    quantidade = max(1, min(MAX_RASCUNHOS_IA, int(dados.get("quantidade") or 4)))
    nivel = dados.get("nivel") if dados.get("nivel") in NIVEIS else "medio"
    tipo = dados.get("tipo") if dados.get("tipo") in (*TIPOS, "misto") else "misto"
    rascunhos = exercicios.gerar_lote(hid, descricao, quantidade, nivel, tipo)
    if rascunhos is None:
        raise ApiErro(503, "A IA não respondeu agora. Tente de novo em alguns instantes ou escreva a pergunta.")
    return {"rascunhos": rascunhos}


def situacao(t: Trilha, dia: str | None = None) -> str:
    if t.status == "rascunho":
        return "rascunho"
    if t.status == "encerrada" or t.fim < (dia or hoje()):
        return "encerrada"
    return "lancada"


def _foco(t: Trilha) -> list[str]:
    return json.loads(t.habilidades)


def habilidades_da_trilha(s, t: Trilha) -> list[str]:
    foco = _foco(t)
    if foco:
        return foco
    vistas: list[str] = []
    for p in perguntas_da_trilha(s, t):
        if p["habilidadeId"] not in vistas:
            vistas.append(p["habilidadeId"])
    return vistas


def perguntas_da_trilha(s, t: Trilha) -> list[dict]:
    ids = json.loads(t.perguntas)
    da_turma = {p.id: p for p in s.execute(select(PerguntaTurma).where(PerguntaTurma.id.in_([i for i in ids if i.startswith("pt")]))).scalars()}
    saida = []
    for i in ids:
        if i in da_turma and da_turma[i].turma_id == t.turma_id:
            saida.append(_servir(da_turma[i]))
        elif i in _BANCO_POR_ID:
            saida.append(_BANCO_POR_ID[i])
    return saida


def _perguntas_professor_da_trilha(s, t: Trilha) -> list[dict]:
    ids = json.loads(t.perguntas)
    da_turma = {p.id: p for p in s.execute(select(PerguntaTurma).where(PerguntaTurma.id.in_([i for i in ids if i.startswith("pt")]))).scalars()}
    saida = []
    for i in ids:
        if i in da_turma and da_turma[i].turma_id == t.turma_id:
            saida.append(_pergunta_professor(da_turma[i]))
        elif i in _BANCO_POR_ID:
            saida.append(_banco_professor(_BANCO_POR_ID[i]))
    return saida


def _resumo_trilha(s, t: Trilha, total_alunos: int) -> dict:
    feitos = s.scalar(select(func.count()).select_from(TrilhaConclusao).where(TrilhaConclusao.trilha_id == t.id)) or 0
    ids = json.loads(t.perguntas)
    return {
        "id": t.id,
        "titulo": t.titulo,
        "disciplinaId": t.disciplina_id,
        "disciplina": nome_disciplina(t.disciplina_id),
        "habilidades": [_habilidade_info(h) for h in _foco(t)],
        "totalPerguntas": len(ids),
        "inicio": t.inicio,
        "fim": t.fim,
        "situacao": situacao(t),
        "feitos": feitos,
        "alunos": total_alunos,
        "criadaEm": t.criada_em,
    }


def _total_alunos(s, turma_id: str) -> int:
    return s.scalar(select(func.count()).select_from(Aluno).where(Aluno.turma_id == turma_id)) or 0


def _detalhe(s, t: Trilha) -> dict:
    return {**_resumo_trilha(s, t, _total_alunos(s, t.turma_id)), "perguntas": _perguntas_professor_da_trilha(s, t)}


def listar_trilhas(email: str, turma_id: str) -> list[dict]:
    with bd.SessionLocal() as s:
        _turma(s, turma_id, email)
        total = _total_alunos(s, turma_id)
        trilhas = list(s.execute(select(Trilha).where(Trilha.turma_id == turma_id).order_by(Trilha.criada_em.desc())).scalars())
        ordem = {"lancada": 0, "rascunho": 1, "encerrada": 2}
        return sorted((_resumo_trilha(s, t, total) for t in trilhas), key=lambda r: ordem[r["situacao"]])


def detalhe_trilha(email: str, trilha_id: str) -> dict:
    with bd.SessionLocal() as s:
        t, _ = _da_turma(s, Trilha, trilha_id, email, "Trilha não encontrada")
        return _detalhe(s, t)


def _normalizar_trilha(s, turma: Turma, dados: dict) -> dict:
    did = dados.get("disciplinaId")
    if did not in disciplinas_com_conteudo(turma.ano) and not any(
        _disciplina_id(h["disciplina"]) == did for h in _habilidades_validas(turma).values()
    ):
        raise ApiErro(422, "Escolha uma matéria desta turma")
    titulo = _limpo(dados.get("titulo"), 80)
    if not titulo:
        raise ApiErro(422, "Dê um nome para a trilha, por exemplo \"Revisão de frações\"")
    validas = _habilidades_validas(turma)
    foco = []
    for hid in dados.get("habilidades") or []:
        if hid not in validas or _disciplina_id(validas[hid]["disciplina"]) != did:
            raise ApiErro(422, "Escolha conteúdos da matéria da trilha")
        if hid not in foco:
            foco.append(hid)
    ids: list[str] = []
    da_turma = {p.id: p for p in s.execute(select(PerguntaTurma).where(PerguntaTurma.turma_id == turma.id)).scalars()}
    for pid in dados.get("perguntas") or []:
        if pid in ids:
            continue
        hid = da_turma[pid].habilidade_id if pid in da_turma else _BANCO_POR_ID.get(pid, {}).get("habilidadeId")
        if not hid or hid not in validas or _disciplina_id(validas[hid]["disciplina"]) != did:
            raise ApiErro(422, "Há perguntas de outra matéria ou que não existem mais nesta trilha")
        ids.append(pid)
    if len(ids) > MAX_PERGUNTAS_TRILHA:
        raise ApiErro(422, f"Uma trilha tem no máximo {MAX_PERGUNTAS_TRILHA} perguntas")
    try:
        fim = date.fromisoformat(str(dados.get("fim")))
    except ValueError:
        raise ApiErro(422, "Escolha até quando a trilha fica disponível") from None
    dia = date.fromisoformat(hoje())
    if fim < dia or fim > dia + timedelta(days=MAX_DIAS):
        raise ApiErro(422, f"A trilha precisa terminar entre hoje e daqui a {MAX_DIAS} dias")
    return {"disciplina_id": did, "titulo": titulo, "habilidades": json.dumps(foco), "perguntas": json.dumps(ids), "fim": fim.isoformat()}


def criar_trilha(email: str, turma_id: str, dados: dict) -> dict:
    with bd.SessionLocal() as s:
        turma = _turma(s, turma_id, email)
        campos = _normalizar_trilha(s, turma, dados)
        t = Trilha(id="tr" + secrets.token_urlsafe(9), turma_id=turma.id, status="rascunho", inicio=None,
                   autor_email=email, criada_em=_agora(), **campos)
        s.add(t)
        s.commit()
        return _detalhe(s, t)


def salvar_trilha(email: str, trilha_id: str, dados: dict) -> dict:
    with bd.SessionLocal() as s:
        t, turma = _da_turma(s, Trilha, trilha_id, email, "Trilha não encontrada")
        if situacao(t) == "encerrada":
            raise ApiErro(409, "Esta trilha já terminou. Crie uma nova para outra semana.")
        for k, v in _normalizar_trilha(s, turma, dados).items():
            setattr(t, k, v)
        s.commit()
        return _detalhe(s, t)


def _ativar(s, turma: Turma, disciplina_id: str, habilidades: list[str]) -> None:
    if not s.get(TurmaDisciplinaAtiva, {"turma_id": turma.id, "disciplina_id": disciplina_id}):
        s.add(TurmaDisciplinaAtiva(turma_id=turma.id, disciplina_id=disciplina_id))
    for hid in habilidades:
        if not s.get(TurmaHabilidadeAtiva, {"turma_id": turma.id, "habilidade_id": hid}):
            s.add(TurmaHabilidadeAtiva(turma_id=turma.id, habilidade_id=hid))


def lancar_trilha(email: str, trilha_id: str) -> dict:
    with bd.SessionLocal() as s:
        t, turma = _da_turma(s, Trilha, trilha_id, email, "Trilha não encontrada")
        if situacao(t) == "encerrada":
            raise ApiErro(409, "Esta trilha já terminou. Crie uma nova para outra semana.")
        perguntas = perguntas_da_trilha(s, t)
        habs = habilidades_da_trilha(s, t)
        if not perguntas and not any(h in COM_PERGUNTAS for h in habs) and not s.scalar(
            select(func.count()).select_from(PerguntaTurma).where(PerguntaTurma.turma_id == turma.id, PerguntaTurma.habilidade_id.in_(habs or [""]))
        ):
            raise ApiErro(422, "Adicione perguntas à trilha antes de lançar")
        t.status = "lancada"
        t.inicio = t.inicio or hoje()
        _ativar(s, turma, t.disciplina_id, habs + [p["habilidadeId"] for p in perguntas])
        s.commit()
        return _detalhe(s, t)


def encerrar_trilha(email: str, trilha_id: str) -> dict:
    with bd.SessionLocal() as s:
        t, _ = _da_turma(s, Trilha, trilha_id, email, "Trilha não encontrada")
        t.status = "encerrada"
        s.commit()
        return _detalhe(s, t)


def excluir_trilha(email: str, trilha_id: str) -> dict:
    with bd.SessionLocal() as s:
        t, _ = _da_turma(s, Trilha, trilha_id, email, "Trilha não encontrada")
        s.execute(delete(TrilhaConclusao).where(TrilhaConclusao.trilha_id == t.id))
        s.delete(t)
        s.commit()
        return {"ok": True}


def conteudos(email: str, turma_id: str) -> dict:
    with bd.SessionLocal() as s:
        t = _turma(s, turma_id, email)
        da_turma: dict[str, int] = {}
        for (hid,) in s.execute(select(PerguntaTurma.habilidade_id).where(PerguntaTurma.turma_id == t.id)):
            da_turma[hid] = da_turma.get(hid, 0) + 1
    no_banco: dict[str, int] = {}
    for p in BANCO:
        no_banco[p["habilidadeId"]] = no_banco.get(p["habilidadeId"], 0) + 1
    disciplinas = []
    for did in ORDEM_MATRIZ:
        nome = nome_disciplina(did)
        unidades: dict[str, list[dict]] = {}
        for h in catalogo_do_ano(t.ano):
            if h["disciplina"] != nome or not h["avaliavel"]:
                continue
            unidades.setdefault(h["unidade"] or "Habilidades", []).append({
                "id": h["id"], "codigoBncc": h["codigoBncc"], "nome": h["nome"],
                "noBanco": no_banco.get(h["id"], 0), "daTurma": da_turma.get(h["id"], 0),
            })
        if unidades:
            disciplinas.append({"id": did, "nome": nome, "unidades": [{"nome": u, "habilidades": hs} for u, hs in unidades.items()]})
    return {"turma": {"id": t.id, "nome": t.nome, "ano": t.ano}, "disciplinas": disciplinas}


def banco_para(email: str, turma_id: str, habilidades: list[str]) -> list[dict]:
    with bd.SessionLocal() as s:
        t = _turma(s, turma_id, email)
    validas = _habilidades_validas(t)
    pedidas = [h for h in habilidades if h in validas][:20]
    return [_banco_professor(q) for q in BANCO if q["habilidadeId"] in pedidas][:80]


def disponiveis(s, turma: Turma) -> list[Trilha]:
    dia = hoje()
    trilhas = s.execute(select(Trilha).where(Trilha.turma_id == turma.id, Trilha.status == "lancada")).scalars()
    return [t for t in trilhas if situacao(t, dia) == "lancada" and (t.inicio or dia) <= dia]


def publicas(s, turma: Turma) -> list[dict]:
    saida = []
    for t in disponiveis(s, turma):
        total = len(json.loads(t.perguntas))
        saida.append({"id": t.id, "disciplinaId": t.disciplina_id, "titulo": t.titulo, "total": total, "fim": t.fim})
    return sorted(saida, key=lambda x: (ORDEM_MATRIZ.index(x["disciplinaId"]) if x["disciplinaId"] in ORDEM_MATRIZ else 99, x["fim"]))


def feitas_por(s, aluno_id: str, trilha_ids: list[str]) -> list[str]:
    if not trilha_ids:
        return []
    return [r for (r,) in s.execute(select(TrilhaConclusao.trilha_id).where(TrilhaConclusao.aluno_id == aluno_id, TrilhaConclusao.trilha_id.in_(trilha_ids)))]


def trilha_disponivel(s, turma: Turma, trilha_id: str) -> Trilha:
    t = s.get(Trilha, trilha_id)
    if not t or t.turma_id != turma.id or t not in disponiveis(s, turma):
        raise ApiErro(410, "Esta trilha da semana terminou. Escolha a trilha normal ou outra matéria.")
    return t


def perguntas_extras(s, turma_id: str, habilidades: list[str] | None = None) -> list[dict]:
    consulta = select(PerguntaTurma).where(PerguntaTurma.turma_id == turma_id)
    if habilidades is not None:
        consulta = consulta.where(PerguntaTurma.habilidade_id.in_(habilidades or [""]))
    return [_servir(p) for p in s.execute(consulta).scalars()]


def habilidades_com_perguntas_da_turma(s, turma_id: str) -> set[str]:
    return {h for (h,) in s.execute(select(PerguntaTurma.habilidade_id).where(PerguntaTurma.turma_id == turma_id).distinct())}


def pergunta_servida(s, pergunta_id: str, turma_id: str | None) -> dict | None:
    if pergunta_id in _BANCO_POR_ID:
        return _BANCO_POR_ID[pergunta_id]
    p = s.get(PerguntaTurma, pergunta_id)
    if p and turma_id and p.turma_id == turma_id:
        return _servir(p)
    return None


def registrar_conclusao(trilha_id: str, aluno_id: str, acertos: int, total: int) -> None:
    with bd.SessionLocal() as s:
        c = s.get(TrilhaConclusao, {"trilha_id": trilha_id, "aluno_id": aluno_id})
        if c:
            c.vezes += 1
        else:
            s.add(TrilhaConclusao(trilha_id=trilha_id, aluno_id=aluno_id, concluida_em=_agora(), acertos=acertos, total=total, vezes=1))
        s.commit()
