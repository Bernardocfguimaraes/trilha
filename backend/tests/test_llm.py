import io
import json
import urllib.error

from app import llm


class _Resposta:
    def __init__(self, texto):
        self._corpo = json.dumps({"choices": [{"message": {"content": texto}}]}).encode()

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def _limite(segundos):
    return urllib.error.HTTPError("u", 429, "limite", {"retry-after": str(segundos)}, io.BytesIO(b'{"error":{"message":"tokens per minute"}}'))


def _provedor():
    return llm.Provedor(nome="teste", api_key="k", base_url="http://x", modelo="m", raciocinio="")


def test_limite_curto_espera_e_tenta_de_novo(monkeypatch):
    respostas = [_limite(0.01), _Resposta("ok")]

    def abrir(*_a, **_k):
        r = respostas.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr(llm.urllib.request, "urlopen", abrir)
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)
    assert llm._chamar(_provedor(), {"messages": []}, espera_max=5) == "ok"


def test_limite_maior_que_o_teto_desiste_na_hora(monkeypatch):
    chamadas = []

    def abrir(*_a, **_k):
        chamadas.append(1)
        raise _limite(40)

    monkeypatch.setattr(llm.urllib.request, "urlopen", abrir)
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)
    assert llm._chamar(_provedor(), {"messages": []}, espera_max=25) is None
    assert len(chamadas) == 1
