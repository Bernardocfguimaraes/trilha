"""Várias turmas: conteúdo por ano, criação, sessões e isolamento entre professores."""
import re

from app import repo, seguranca
from tests.conftest import entrar_como_aluno


def test_demo_tem_duas_turmas_e_historia(cliente, auth):
    turmas = {t["id"]: t for t in cliente.get("/turmas", headers=auth).json()}
    assert {"t1", "t8"} <= set(turmas) and turmas["t8"]["alunos"] == 6
    anos = cliente.get("/anos", headers=auth).json()
    assert [a["ano"] for a in anos] == [4, 6, 8]
    assert all(len(a["disciplinas"]) == 6 and "História" in a["disciplinas"] for a in anos)
    publica = cliente.get("/turmas/TUCANO8").json()
    assert publica["nome"] == "8º ano A" and len(publica["disciplinas"]) == 6


def test_criar_turma_e_adicionar_aluno(cliente, auth):
    r = cliente.post("/turmas", json={"nome": "6º ano B", "ano": 6, "alunos": ["Ana Teste", "Bruno Teste"]}, headers=auth)
    assert r.status_code == 201
    nova = r.json()
    assert re.fullmatch(r"[A-Z]+6[A-Z]?", nova["codigo"]) and nova["alunos"] == 2
    aluno = cliente.post(f"/turmas/{nova['id']}/alunos", json={"nome": "Caio Teste"}, headers=auth).json()
    assert re.fullmatch(r"\d{4}", aluno["pin"])
    cfg = cliente.get(f"/turmas/{nova['id']}/configuracao", headers=auth).json()
    codigos = [h["codigoBncc"] for d in cfg["disciplinas"] for h in d["habilidades"] if h["codigoBncc"]]
    assert codigos and all(c[2:4] in ("06", "67", "69") for c in codigos)


def test_criar_turma_valida_entrada(cliente, auth):
    assert cliente.post("/turmas", json={"nome": "5º", "ano": 5, "alunos": []}, headers=auth).status_code == 422
    assert cliente.post("/turmas", json={"nome": "", "ano": 6}, headers=auth).status_code == 422
    assert cliente.post("/turmas", json={"nome": "X", "ano": 12}, headers=auth).status_code == 422


def test_sessao_do_8_ano_usa_conteudo_do_8_ano(cliente, auth):
    acesso = entrar_como_aluno(cliente, auth, "t8", "b2")
    r = cliente.post("/sessoes", json={"codigo": "TUCANO8", "alunoId": "b2", "acesso": acesso, "disciplinaId": "his"})
    assert r.status_code == 200
    assert all(p["habilidadeId"].startswith("EF08HI") for p in r.json()["perguntas"])
    # O código de outra turma não serve para este aluno.
    r = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "b2", "acesso": acesso, "disciplinaId": "his"})
    assert r.status_code == 404


def test_professor_nao_ve_turma_de_outro(cliente, auth):
    repo.salvar_professor("outro@teste.com", "Prof. Outro", seguranca.hash_senha("senha-do-outro-1"))
    outro = cliente.post("/auth/entrar", json={"email": "outro@teste.com", "senha": "senha-do-outro-1"}).json()["token"]
    h = {"Authorization": f"Bearer {outro}"}
    assert cliente.get("/turmas", headers=h).json() == []
    for metodo, rota in [("GET", "/turmas/t1/alunos"), ("GET", "/turmas/t1/cadastros"), ("PUT", "/turmas/t1/configuracao"),
                         ("POST", "/turmas/t1/alunos"), ("GET", "/alunos/a1"), ("POST", "/alunos/a1/pin"),
                         ("GET", "/alunos/a1/diagnostico"), ("PUT", "/alunos/a1/diagnostico/EF04LP01")]:
        corpo = {"habilidadesAtivas": []} if "configuracao" in rota else {"nome": "Intruso X", "status": "ok"}
        assert cliente.request(metodo, rota, json=corpo, headers=h).status_code == 404, rota
    dele = cliente.post("/turmas", json={"nome": "8º C", "ano": 8, "alunos": []}, headers=h).json()
    assert dele["id"] not in {t["id"] for t in cliente.get("/turmas", headers=auth).json()}
    assert cliente.get(f"/turmas/{dele['id']}/alunos", headers=auth).status_code == 404
