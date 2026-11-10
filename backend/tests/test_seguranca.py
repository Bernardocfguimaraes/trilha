"""Segurança: login, rotas protegidas, credenciais, sessões e entradas."""
import re

import pytest

from tests.conftest import entrar_como_aluno

ROTAS_PROFESSOR = [
    ("GET", "/turmas"), ("POST", "/turmas"), ("GET", "/anos"), ("GET", "/modelo"),
    ("GET", "/turmas/t1/alunos"), ("POST", "/turmas/t1/alunos"), ("GET", "/turmas/t1/cadastros"),
    ("GET", "/turmas/t1/configuracao"), ("PUT", "/turmas/t1/configuracao"), ("POST", "/turmas/t1/diagnostico"),
    ("POST", "/turmas/t1/chat"), ("GET", "/alunos/a1"), ("GET", "/alunos/a1/historico"),
    ("GET", "/alunos/a1/diagnostico"), ("PUT", "/alunos/a1/diagnostico/EF04LP01"), ("POST", "/alunos/a1/pin"),
    ("POST", "/exercicios/gerar"), ("POST", "/voz/transcrever"), ("GET", "/auth/eu"),
]


@pytest.mark.parametrize("metodo,rota", ROTAS_PROFESSOR)
def test_rotas_do_professor_exigem_login(cliente, metodo, rota):
    assert cliente.request(metodo, rota, json={}).status_code == 401
    assert cliente.request(metodo, rota, json={}, headers={"Authorization": "Bearer abc.def"}).status_code == 401


def test_token_adulterado_e_recusado(cliente, token):
    corpo, assinatura = token.split(".")
    adulterado = corpo[:-2] + ("AA" if corpo[-2:] != "AA" else "BB") + "." + assinatura
    assert cliente.get("/turmas", headers={"Authorization": f"Bearer {adulterado}"}).status_code == 401


def test_login_errado_e_bloqueio(cliente):
    assert cliente.post("/auth/entrar", json={"email": "prof@teste.com", "senha": "errada"}).status_code == 401
    assert cliente.post("/auth/entrar", json={"email": "ninguem@x.com", "senha": "x"}).status_code == 401
    for _ in range(5):
        cliente.post("/auth/entrar", json={"email": "alvo@x.com", "senha": "x"})
    assert cliente.post("/auth/entrar", json={"email": "alvo@x.com", "senha": "x"}).status_code == 429


def test_login_ignora_maiusculas_no_email(cliente):
    r = cliente.post("/auth/entrar", json={"email": "PROF@TESTE.COM", "senha": "senha-de-teste-123"})
    assert r.status_code == 200 and r.json()["nome"] == "Profa. Teste"


def test_credencial_do_pin_e_aleatoria_e_presa_ao_aluno(cliente, auth):
    acesso = entrar_como_aluno(cliente, auth, "t1", "a2")
    assert "a2" not in acesso and len(acesso) >= 40
    r = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a3", "acesso": acesso, "disciplinaId": "mat"})
    assert r.status_code == 401


def test_sessao_sem_gabarito_aberto_e_sem_estrela_repetida(cliente, auth):
    acesso = entrar_como_aluno(cliente, auth, "t1", "a4")
    sessao = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a4", "acesso": acesso, "disciplinaId": "mat"}).json()
    sid = sessao["sessaoId"]
    assert not re.fullmatch(r"s\d+", sid) and len(sid) > 15
    # Sem sessão não há resposta certa; pergunta fora da sessão é recusada.
    assert cliente.post("/sessoes/s1700000000000/respostas", json={"perguntaId": "ad1", "opcaoId": "x"}).status_code == 404
    ids = {p["id"] for p in sessao["perguntas"]}
    fora = next(i for i in ["ef04lp01-f1", "ad1", "go1", "cs1"] if i not in ids)
    assert cliente.post(f"/sessoes/{sid}/respostas", json={"perguntaId": fora, "opcaoId": "x"}).status_code == 403
    # Responder a mesma pergunta várias vezes não soma estrelas.
    p = sessao["perguntas"][0]
    for opcao in p["opcoes"]:
        cliente.post(f"/sessoes/{sid}/respostas", json={"perguntaId": p["id"], "opcaoId": opcao["id"]})
    assert cliente.post(f"/sessoes/{sid}/concluir").json()["estrelas"] <= 1
    assert cliente.post("/sessoes/s1700000000000/concluir").status_code == 404


def test_limites_de_entrada(cliente, auth):
    assert cliente.post("/acesso/pin", json={"alunoId": "a1", "pin": "12a4"}).status_code == 422
    assert cliente.post("/turmas/t1/chat", json={"pergunta": "x" * 5000, "historico": []}, headers=auth).status_code == 422
    grande = b"0" * (8 * 1024 * 1024 + 10)
    r = cliente.post("/voz/transcrever", files={"audio": ("a.webm", grande, "audio/webm")}, headers=auth)
    assert r.status_code == 413


def test_cors_e_cabecalhos(cliente):
    r = cliente.get("/saude", headers={"Origin": "http://site-malicioso.com"})
    assert "access-control-allow-origin" not in r.headers
    r = cliente.get("/saude", headers={"Origin": "http://localhost:3000"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["cache-control"] == "no-store"


def test_cors_aceita_so_origens_configuradas(cliente):
    def preflight(origem):
        r = cliente.options("/saude", headers={"Origin": origem, "Access-Control-Request-Method": "GET"})
        return r.headers.get("access-control-allow-origin")
    assert preflight("http://localhost:3000") == "http://localhost:3000"
    assert preflight("https://trilha.vercel.app") == "https://trilha.vercel.app"
    assert preflight("https://trilha-git-main-bernardo.vercel.app") == "https://trilha-git-main-bernardo.vercel.app"
    assert preflight("https://site-malicioso.com") is None
    assert preflight("https://trilha.vercel.app.golpe.com") is None
