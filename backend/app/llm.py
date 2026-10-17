"""Cliente de LLM (passo 4) — fala com qualquer provedor compatível com a API da OpenAI.

Lê do .env:
  LLM_API_KEY   chave do provedor (sem ela, o LLM fica desligado e tudo cai no fallback)
  LLM_BASE_URL  padrão https://api.groq.com/openai/v1  (Groq; Llama grátis)
  LLM_MODEL     padrão llama-3.3-70b-versatile

Usa só a biblioteca padrão (urllib) — nenhuma dependência nova no backend. Qualquer erro
(sem chave, timeout, cota, rede) faz `gerar` devolver None, e quem chamou usa o texto pronto.
Assim a demo nunca quebra por causa do LLM.
"""
from __future__ import annotations

import json
import os
import urllib.request

API_KEY = os.environ.get("LLM_API_KEY")
BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
MODEL = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")
TIMEOUT = 30


def disponivel() -> bool:
    return bool(API_KEY)


def gerar(sistema: str, mensagens: list[dict], temperatura: float = 0.4, max_tokens: int = 500) -> str | None:
    """Chama o chat completions. `mensagens` é [{'role': 'user'|'assistant', 'content': ...}].
    Devolve o texto, ou None se o LLM não estiver configurado ou a chamada falhar."""
    if not API_KEY:
        return None
    corpo = {
        "model": MODEL,
        "messages": [{"role": "system", "content": sistema}, *mensagens],
        "temperature": temperatura,
        "max_tokens": max_tokens,
    }
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps(corpo).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            dados = json.loads(resp.read().decode("utf-8"))
        texto = dados["choices"][0]["message"]["content"].strip()
        return texto or None
    except Exception:
        # Falha graciosa: quem chamou decide o fallback. Não derruba a requisição.
        return None
