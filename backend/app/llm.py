from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

API_KEY = os.environ.get("LLM_API_KEY")
BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
MODEL = os.environ.get("LLM_MODEL", "openai/gpt-oss-120b")
REASONING_EFFORT = os.environ.get("LLM_REASONING_EFFORT", "none")
TIMEOUT = 30
ESPERAR_LIMITE = False
_ESPERA_MAXIMA = 120


class CotaEsgotada(Exception):
    pass


@dataclass
class Provedor:
    nome: str
    api_key: str
    base_url: str
    modelo: str
    raciocinio: str
    esgotado: bool = False


def _raciocinio_padrao_revisor(modelo: str) -> str:
    m = modelo.lower()
    if "gpt-oss" in m:
        return "high"
    if "qwen" in m:
        return "default"
    return ""


def _montar() -> tuple[list[Provedor], list[Provedor]]:
    env = os.environ.get
    principal = reserva = None
    if API_KEY:
        principal = Provedor("principal", API_KEY, BASE_URL, MODEL, REASONING_EFFORT)
    if env("LLM_RESERVA_API_KEY") and env("LLM_RESERVA_MODEL"):
        reserva = Provedor(
            "reserva", env("LLM_RESERVA_API_KEY"),
            env("LLM_RESERVA_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai").rstrip("/"),
            env("LLM_RESERVA_MODEL"), env("LLM_RESERVA_REASONING_EFFORT", ""),
        )
    revisor = None
    modelo_rev = env("LLM_REVISOR_MODEL")
    if modelo_rev and (env("LLM_REVISOR_API_KEY") or API_KEY):
        revisor = Provedor(
            "revisor", env("LLM_REVISOR_API_KEY") or API_KEY,
            (env("LLM_REVISOR_BASE_URL") or BASE_URL).rstrip("/"), modelo_rev,
            env("LLM_REVISOR_REASONING_EFFORT", _raciocinio_padrao_revisor(modelo_rev)),
        )
    elif principal:
        revisor = Provedor("revisor", API_KEY, BASE_URL, MODEL, _raciocinio_padrao_revisor(MODEL))
    geral = [p for p in (principal, reserva) if p]
    rev = [p for p in (revisor, reserva) if p]
    return geral, rev


_GERAL, _REVISOR = _montar()


def disponivel() -> bool:
    return bool(_GERAL)


def modelos() -> dict[str, str]:
    return {"gerador": _GERAL[0].modelo if _GERAL else "", "revisor": _REVISOR[0].modelo if _REVISOR else ""}


def _cota_diaria(e: urllib.error.HTTPError, espera: float) -> bool:
    try:
        corpo = e.read().decode("utf-8", "ignore").lower()
    except Exception:
        corpo = ""
    return espera > _ESPERA_MAXIMA or "per day" in corpo or "daily" in corpo or "per_day" in corpo


def _chamar(p: Provedor, corpo: dict) -> str | None:
    if p.raciocinio:
        corpo = {**corpo, "reasoning_effort": p.raciocinio}
    req = urllib.request.Request(
        f"{p.base_url}/chat/completions",
        data=json.dumps({**corpo, "model": p.modelo}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {p.api_key}",
            "User-Agent": "trilha-backend/1.0",
        },
        method="POST",
    )
    for tentativa in range(8 if ESPERAR_LIMITE else 1):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                dados = json.loads(resp.read().decode("utf-8"))
            texto = (dados["choices"][0]["message"].get("content") or "").strip()
            return texto or None
        except urllib.error.HTTPError as e:
            if e.code != 429:
                return None
            espera = float(e.headers.get("retry-after") or 0) or 15.0 * (tentativa + 1)
            if _cota_diaria(e, espera):
                p.esgotado = True
                return None
            if not ESPERAR_LIMITE:
                return None
            time.sleep(espera + 1)
        except Exception:
            return None
    return None


def gerar(sistema: str, mensagens: list[dict], temperatura: float = 0.4, max_tokens: int = 500,
          papel: str = "geral") -> str | None:
    provedores = _REVISOR if papel == "revisor" else _GERAL
    corpo = {
        "messages": [{"role": "system", "content": sistema}, *mensagens],
        "temperature": temperatura,
        "max_tokens": max_tokens,
    }
    for p in provedores:
        if p.esgotado:
            continue
        texto = _chamar(p, corpo)
        if texto:
            return texto
    if ESPERAR_LIMITE and provedores and all(p.esgotado for p in provedores):
        raise CotaEsgotada(f"cota do dia esgotada para o papel '{papel}' ({', '.join(p.modelo for p in provedores)})")
    return None
