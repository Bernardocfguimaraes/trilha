"""Responsável: só o progresso do próprio filho, pela credencial do PIN."""
from tests.conftest import entrar_como_aluno


def test_progresso_so_do_dono_da_credencial(cliente, auth):
    acesso = entrar_como_aluno(cliente, auth, "t1", "a5")
    r = cliente.post("/responsavel/progresso", json={"acesso": acesso, "alunoId": "a1"})
    assert r.status_code == 200
    dados = r.json()
    assert set(dados) == {"aluno", "historico"} and dados["aluno"]["id"] == "a5"
    assert '"pin"' not in r.text.lower()


def test_credencial_invalida_ou_revogada(cliente, auth):
    assert cliente.post("/responsavel/progresso", json={"acesso": "inventada"}).status_code == 401
    acesso = entrar_como_aluno(cliente, auth, "t1", "a6")
    assert cliente.post("/responsavel/progresso", json={"acesso": acesso}).status_code == 200
    cliente.post("/alunos/a6/pin", headers=auth)  # o professor troca o PIN
    assert cliente.post("/responsavel/progresso", json={"acesso": acesso}).status_code == 401
