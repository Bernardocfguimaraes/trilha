import os

os.environ.update({
    "DATABASE_URL": "",
    "LLM_API_KEY": "",
    "PROFESSOR_EMAIL": "prof@teste.com",
    "PROFESSOR_SENHA": "senha-de-teste-123",
    "PROFESSOR_NOME": "Profa. Teste",
    "TRILHA_SEGREDO": "0" * 64,
    "TRILHA_CORS": "http://localhost:3000",
    "TRILHA_CORS_REGEX": r"https://trilha(-[a-z0-9-]+)?\.vercel\.app",
})

import pytest
from fastapi.testclient import TestClient

from app.main import app

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
    pins = {a["id"]: a["pin"] for a in cliente.get(f"/turmas/{turma_id}/cadastros", headers=auth).json()}
    r = cliente.post("/acesso/pin", json={"alunoId": aluno_id, "pin": pins[aluno_id]})
    assert r.json()["valido"], r.text
    return r.json()["acesso"]
