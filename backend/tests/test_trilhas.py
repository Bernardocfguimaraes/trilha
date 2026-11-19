import json
from datetime import date, timedelta

from app import bd, exercicios, regras, trilhas
from app.dados import BANCO
from app.modelos import TurmaHabilidadeAtiva
from app.regras import hoje
from tests.conftest import entrar_como_aluno

AMANHA = (date.fromisoformat(hoje()) + timedelta(days=1)).isoformat()
SEMANA = (date.fromisoformat(hoje()) + timedelta(days=7)).isoformat()


def _pergunta(cliente, auth, i, **extra):
    corpo = {"tipo": "escolha", "habilidadeId": "mat-fracoes", "nivel": "facil",
             "enunciado": f"Uma pizza tem {i + 2} pedaços iguais. Que fração é um pedaço?",
             "opcoes": [f"1/{i + 2}", f"2/{i + 3}", f"3/{i + 4}", f"4/{i + 5}"], "certa": 0, **extra}
    r = cliente.post("/turmas/t1/perguntas", json=corpo, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def _trilha(cliente, auth, perguntas, **extra):
    corpo = {"disciplinaId": "mat", "titulo": "Revisão de frações", "habilidades": ["mat-fracoes"], "perguntas": perguntas, "fim": SEMANA, **extra}
    r = cliente.post("/turmas/t1/trilhas", json=corpo, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def _responder_tudo(cliente, sessao):
    for p in sessao["perguntas"]:
        r = cliente.post(f"/sessoes/{sessao['sessaoId']}/respostas", json={"perguntaId": p["id"], "opcaoId": p["opcoes"][0]["id"]})
        assert r.status_code == 200, r.text
        assert "proxima" not in r.json()
    return cliente.post(f"/sessoes/{sessao['sessaoId']}/concluir").json()


def test_conteudos_mostram_unidades_e_quantas_perguntas_existem(cliente, auth):
    c = cliente.get("/turmas/t8/conteudos", headers=auth).json()
    historia = next(d for d in c["disciplinas"] if d["id"] == "his")
    habilidades = [h for u in historia["unidades"] for h in u["habilidades"]]
    revolucao = next(h for h in habilidades if h["codigoBncc"] == "EF08HI03")
    assert revolucao["nome"] == "Revolução Industrial" and revolucao["noBanco"] > 0 and revolucao["daTurma"] == 0


def test_validacao_da_pergunta_da_professora(cliente, auth):
    base = {"tipo": "escolha", "habilidadeId": "mat-fracoes", "nivel": "medio", "enunciado": "Quanto é metade de 10?", "certa": 0}
    assert cliente.post("/turmas/t1/perguntas", json={**base, "opcoes": ["5", "2", "20"]}, headers=auth).status_code == 422
    assert cliente.post("/turmas/t1/perguntas", json={**base, "opcoes": ["5", "5", "20", "8"]}, headers=auth).status_code == 422
    assert cliente.post("/turmas/t1/perguntas", json={**base, "habilidadeId": "EF08HI03", "opcoes": ["5", "2", "20", "8"]}, headers=auth).status_code == 422
    longa = cliente.post("/turmas/t1/perguntas", json={**base, "opcoes": ["Cinco inteiros, que é a metade exata de dez", "2", "20", "8"]}, headers=auth)
    assert longa.status_code == 201 and any("tamanho" in a for a in longa.json()["avisos"])
    cliente.post(f"/perguntas/{longa.json()['pergunta']['id']}/excluir", headers=auth)


def test_completar_a_frase_monta_o_enunciado_que_a_trilha_entende(cliente, auth):
    corpo = {"tipo": "lacuna", "habilidadeId": "mat-fracoes", "nivel": "facil", "instrucao": "Complete com a fração certa",
             "frase": "Metade de uma pizza é ___ da pizza.", "opcoes": ["1/2", "1/3", "1/4"], "certa": 0}
    r = cliente.post("/turmas/t1/perguntas", json=corpo, headers=auth)
    assert r.status_code == 201, r.text
    p = r.json()["pergunta"]
    assert p["enunciado"] == 'Complete com a fração certa: "Metade de uma pizza é ___ da pizza."' and p["tipo"] == "lacuna"
    assert cliente.post("/turmas/t1/perguntas", json={**corpo, "frase": "Metade de uma pizza."}, headers=auth).status_code == 422
    cliente.post(f"/perguntas/{p['id']}/excluir", headers=auth)


def test_trilha_da_semana_com_as_perguntas_da_professora(cliente, auth):
    ids = [_pergunta(cliente, auth, i)["pergunta"]["id"] for i in range(8)]
    t = _trilha(cliente, auth, ids)
    assert t["situacao"] == "rascunho" and t["totalPerguntas"] == 8
    assert all(x["id"] != t["id"] for x in cliente.get("/turmas/SABIA4").json()["trilhas"])

    lancada = cliente.post(f"/trilhas/{t['id']}/lancar", headers=auth).json()
    assert lancada["situacao"] == "lancada" and lancada["inicio"] == hoje()
    publica = next(x for x in cliente.get("/turmas/SABIA4").json()["trilhas"] if x["id"] == t["id"])
    assert publica == {"id": t["id"], "disciplinaId": "mat", "titulo": "Revisão de frações", "total": 8, "fim": SEMANA}

    acesso = entrar_como_aluno(cliente, auth, "t1", "a10")
    ordens = []
    for _ in range(4):
        s = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a10", "acesso": acesso, "disciplinaId": "mat", "trilhaId": t["id"], "modo": "semana"}).json()
        assert sorted(p["id"] for p in s["perguntas"]) == sorted(ids)
        ordens.append([p["id"] for p in s["perguntas"]])
    assert len({tuple(o) for o in ordens}) > 1

    fim = _responder_tudo(cliente, s)
    assert fim["total"] == 8 and fim["trilhaId"] == t["id"]
    resumo = next(x for x in cliente.get("/turmas/t1/trilhas", headers=auth).json() if x["id"] == t["id"])
    assert resumo["feitos"] == 1 and resumo["alunos"] >= 10

    pins = {a["id"]: a["pin"] for a in cliente.get("/turmas/t1/cadastros", headers=auth).json()}
    assert t["id"] in cliente.post("/acesso/pin", json={"alunoId": "a10", "pin": pins["a10"]}).json()["trilhasFeitas"]

    revisao = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a10", "acesso": acesso, "trilhaId": t["id"], "modo": "revisao"}).json()
    assert sorted(p["id"] for p in revisao["perguntas"]) == sorted(ids)
    praticar = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a10", "acesso": acesso, "trilhaId": t["id"], "modo": "praticar"}).json()
    assert 0 < len(praticar["perguntas"]) <= 6 and all(p["habilidadeId"] == "mat-fracoes" for p in praticar["perguntas"])

    r = cliente.post(f"/perguntas/{ids[0]}/excluir", headers=auth)
    assert r.status_code == 409
    cliente.post(f"/trilhas/{t['id']}/encerrar", headers=auth)
    assert all(x["id"] != t["id"] for x in cliente.get("/turmas/SABIA4").json()["trilhas"])
    r = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a10", "acesso": acesso, "trilhaId": t["id"], "modo": "semana"})
    assert r.status_code == 410


def test_trilha_fica_indisponivel_depois_do_prazo(cliente, auth, monkeypatch):
    t = _trilha(cliente, auth, [p["id"] for p in BANCO if p["habilidadeId"] == "mat-mult"][:3], habilidades=["mat-mult"], titulo="Tabuada", fim=hoje())
    cliente.post(f"/trilhas/{t['id']}/lancar", headers=auth)
    assert any(x["id"] == t["id"] for x in cliente.get("/turmas/SABIA4").json()["trilhas"])
    monkeypatch.setattr(trilhas, "hoje", lambda: AMANHA)
    assert all(x["id"] != t["id"] for x in cliente.get("/turmas/SABIA4").json()["trilhas"])
    acesso = entrar_como_aluno(cliente, auth, "t1", "a7")
    r = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a7", "acesso": acesso, "trilhaId": t["id"], "modo": "semana"})
    assert r.status_code == 410
    detalhe = cliente.get(f"/trilhas/{t['id']}", headers=auth).json()
    assert detalhe["situacao"] == "encerrada"


def test_regras_da_trilha(cliente, auth):
    passado = (date.fromisoformat(hoje()) - timedelta(days=1)).isoformat()
    base = {"disciplinaId": "mat", "titulo": "X", "habilidades": ["mat-fracoes"], "perguntas": [], "fim": SEMANA}
    assert cliente.post("/turmas/t1/trilhas", json={**base, "fim": passado}, headers=auth).status_code == 422
    assert cliente.post("/turmas/t1/trilhas", json={**base, "habilidades": ["EF35LP06"]}, headers=auth).status_code == 422
    assert cliente.post("/turmas/t1/trilhas", json={**base, "titulo": " "}, headers=auth).status_code == 422
    assert cliente.post("/turmas/t1/trilhas", json={**base, "perguntas": ["nao-existe"]}, headers=auth).status_code == 422
    assert cliente.get("/turmas/t1/trilhas").status_code == 401
    assert cliente.post("/turmas/t1/perguntas", json={}).status_code in (401, 422)


def test_lancar_ativa_os_conteudos_da_trilha_na_turma(cliente, auth):
    with bd.SessionLocal() as s:
        s.query(TurmaHabilidadeAtiva).filter_by(turma_id="t8", habilidade_id="EF08HI03").delete()
        s.commit()
    banco = cliente.get("/turmas/t8/banco?habilidades=EF08HI03", headers=auth).json()
    assert banco and all(q["origem"] == "banco" and q["habilidade"]["id"] == "EF08HI03" for q in banco)
    t = cliente.post("/turmas/t8/trilhas", json={"disciplinaId": "his", "titulo": "Revolução Industrial", "habilidades": ["EF08HI03"],
                                                  "perguntas": [q["id"] for q in banco[:4]], "fim": SEMANA}, headers=auth).json()
    cliente.post(f"/trilhas/{t['id']}/lancar", headers=auth)
    with bd.SessionLocal() as s:
        assert s.get(TurmaHabilidadeAtiva, {"turma_id": "t8", "habilidade_id": "EF08HI03"}) is not None


def test_trilha_normal_tambem_usa_as_perguntas_da_turma():
    extra = {"id": "pt-teste", "habilidadeId": "mat-fracoes", "nivel": "facil", "enunciado": "Quanto é metade de 8?",
             "opcoes": ["4", "2", "6", "8"], "certa": 0, "apoio": None}
    usadas = {p["id"] for p in BANCO}
    assert regras.escolher_pergunta(["mat-fracoes"], "facil", usadas, 0, [extra]) == extra


def _llm_falso(monkeypatch, respostas):
    chamadas = []

    def gerar(sistema, mensagens, temperatura=0.4, max_tokens=500, papel="geral"):
        chamadas.append(papel)
        return respostas[papel]

    monkeypatch.setattr(exercicios.llm, "disponivel", lambda: True)
    monkeypatch.setattr(exercicios.llm, "gerar", gerar)
    return chamadas


def test_ia_gera_rascunhos_da_aula_em_duas_chamadas(cliente, auth, monkeypatch):
    lote = {"perguntas": [
        {"tipo": "escolha", "enunciado": "Numa receita de bolo, usamos metade de 4 xícaras. Quantas xícaras?", "opcoes": ["2", "4", "1", "3"], "indiceCorreta": 0, "explicacao": "Metade de 4 é 2."},
        {"tipo": "lacuna", "instrucao": "Complete a frase", "frase": "Um quarto da receita é ___ do total.", "opcoes": ["1/4", "1/2", "3/4", "2/3"], "indiceCorreta": 0, "explicacao": "Um quarto é 1/4."},
        {"tipo": "escolha", "enunciado": "Sem pergunta", "opcoes": ["a", "b"], "indiceCorreta": 0},
    ]}
    revisoes = {"revisoes": [
        {"numero": 1, "analise": "ok", "resposta": 0, "unicaCorreta": True, "conteudoCorreto": True, "avaliaHabilidade": True, "problema": ""},
        {"numero": 2, "analise": "x", "resposta": 2, "unicaCorreta": True, "conteudoCorreto": True, "avaliaHabilidade": True, "problema": "Duas respostas possíveis"},
    ]}
    chamadas = _llm_falso(monkeypatch, {"geral": json.dumps(lote), "revisor": json.dumps(revisoes)})
    r = cliente.post("/turmas/t1/perguntas/rascunhos", json={"habilidadeId": "mat-fracoes", "descricao": "Revisei frações com receita de bolo", "quantidade": 3}, headers=auth)
    assert r.status_code == 200, r.text
    rascunhos = r.json()["rascunhos"]
    assert chamadas == ["geral", "revisor"]
    assert len(rascunhos) == 2
    assert rascunhos[0]["revisao"]["aprovada"] is True
    assert rascunhos[1]["tipo"] == "lacuna" and rascunhos[1]["enunciado"] == 'Complete a frase: "Um quarto da receita é ___ do total."'
    assert rascunhos[1]["revisao"]["aprovada"] is False and "Duas" in rascunhos[1]["revisao"]["problema"]

    salvo = cliente.post("/turmas/t1/perguntas", json={**{k: rascunhos[0][k] for k in ("tipo", "habilidadeId", "nivel", "enunciado", "opcoes", "certa", "explicacao")},
                                                       "origem": "ia", "revisao": rascunhos[0]["revisao"]}, headers=auth).json()["pergunta"]
    assert salvo["origem"] == "ia" and salvo["revisao"]["aprovada"] is True


def test_revisar_pergunta_escrita_usa_uma_chamada(cliente, auth, monkeypatch):
    p = _pergunta(cliente, auth, 20)["pergunta"]
    veredito = {"analise": "ok", "resposta": 0, "unicaCorreta": True, "conteudoCorreto": True, "avaliaHabilidade": True, "problema": ""}
    chamadas = _llm_falso(monkeypatch, {"revisor": json.dumps(veredito)})
    r = cliente.post(f"/perguntas/{p['id']}/revisar", headers=auth)
    assert r.status_code == 200 and chamadas == ["revisor"]
    assert r.json()["revisao"]["aprovada"] is True
    editada = cliente.put(f"/perguntas/{p['id']}", json={"tipo": "escolha", "habilidadeId": "mat-fracoes", "nivel": "facil",
                                                          "enunciado": "Que fração é um pedaço de 22?", "opcoes": p["opcoes"], "certa": 0}, headers=auth).json()
    assert editada["pergunta"]["revisao"] is None


def test_ia_indisponivel_avisa_sem_quebrar(cliente, auth):
    r = cliente.post("/turmas/t1/perguntas/rascunhos", json={"habilidadeId": "mat-fracoes", "descricao": "Revisei frações com receita de bolo"}, headers=auth)
    assert r.status_code == 503 and "IA" in r.text
