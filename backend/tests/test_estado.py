import importlib

from sqlalchemy import select

from app import bd, estado
from app.modelos import EstadoTemporario
from tests.conftest import entrar_como_aluno


def _chaves(prefixo):
    with bd.SessionLocal() as s:
        return [c for c in s.scalars(select(EstadoTemporario.chave)) if c.startswith(prefixo)]


def test_trilha_continua_em_outra_instancia_da_api(cliente, auth):
    from app import repo

    acesso = entrar_como_aluno(cliente, auth, "t1", "a8")
    assert _chaves("acesso:")
    sessao = cliente.post("/sessoes", json={"codigo": "SABIA4", "alunoId": "a8", "acesso": acesso, "disciplinaId": "mat"}).json()
    sid = sessao["sessaoId"]
    assert "sessao:" + sid in _chaves("sessao:")

    importlib.reload(repo)

    perguntas = sessao["perguntas"]
    for i in range(len(perguntas)):
        p = perguntas[i]
        r = cliente.post(f"/sessoes/{sid}/respostas", json={"perguntaId": p["id"], "opcaoId": p["opcoes"][0]["id"]})
        assert r.status_code == 200
        if r.json().get("proxima") and i + 1 < len(perguntas):
            perguntas[i + 1] = r.json()["proxima"]
    fim = cliente.post(f"/sessoes/{sid}/concluir")
    assert fim.status_code == 200 and fim.json()["total"] == len(perguntas)


def test_bloqueio_do_pin_fica_no_banco(cliente):
    for _ in range(5):
        cliente.post("/acesso/pin", json={"alunoId": "a9", "pin": "0000"})
    assert estado.ler("pin:a9")["bloqueadoAte"] > 0


def test_estado_vencido_some(monkeypatch):
    estado.gravar("teste:x", {"a": 1}, 60)
    assert estado.ler("teste:x") == {"a": 1}
    import time

    agora = time.time()
    monkeypatch.setattr(time, "time", lambda: agora + 120)
    assert estado.ler("teste:x") is None


def test_recomendacao_da_ia_fica_no_banco_e_nao_chama_a_ia_de_novo(monkeypatch):
    from app import recomendacoes

    chamadas = []
    monkeypatch.setattr(recomendacoes.llm, "disponivel", lambda: True)
    monkeypatch.setattr(recomendacoes.llm, "gerar", lambda *a, **k: chamadas.append(1) or f"Texto {len(chamadas)}")
    pedidos = [("hab-x", "Hab X", "Matemática", "alerta"), ("hab-y", "Hab Y", "Ciências", "atencao")]
    primeira = recomendacoes.textos_para(pedidos)
    assert len(chamadas) == 2 and sorted(primeira) == ["Texto 1", "Texto 2"]
    recomendacoes._cache.clear()
    assert recomendacoes.textos_para(pedidos) == primeira
    assert len(chamadas) == 2
