"""Ambiente de teste: o app inteiro em memória (SQLite em memória, sem rede, sem LLM).

As variáveis são definidas ANTES de importar o app: o .env do desenvolvedor não interfere
(o python-dotenv não sobrescreve variáveis que já existem).
"""
import os

os.environ.update({
    "DATABASE_URL": "",               # SQLite em memória, com a demo
    "LLM_API_KEY": "",                # sem chamadas externas: textos prontos e banco curado
    "PROFESSOR_EMAIL": "prof@teste.com",
    "PROFESSOR_SENHA": "senha-de-teste-123",
    "PROFESSOR_NOME": "Profa. Teste",
    "TRILHA_SEGREDO": "0" * 64,
    "TRILHA_CORS": "http://localhost:3000",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

EMAIL, SENHA = os.environ["PROFESSOR_EMAIL"], os.environ["PROFESSOR_SENHA"]


@pytest.fixture(scope="session")
def cliente():
    return TestClient(app)


@pytest.fixture(scope="session")
def token(cliente):
    r = cliente.post("/auth/entrar", json={"email": EMAIL, "senha": SENHA})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


def entrar_como_aluno(cliente, auth, turma_id: str, aluno_id: str) -> str:
    """Credencial do PIN de um aluno (lê o PIN como professor)."""
    pins = {a["id"]: a["pin"] for a in cliente.get(f"/turmas/{turma_id}/cadastros", headers=auth).json()}
    r = cliente.post("/acesso/pin", json={"alunoId": aluno_id, "pin": pins[aluno_id]})
    assert r.json()["valido"], r.text
    return r.json()["acesso"]
