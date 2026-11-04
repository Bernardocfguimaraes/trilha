"""Cliente de LLM (passo 4) — fala com qualquer provedor compatível com a API da OpenAI.

Lê do .env (só LLM_API_KEY é obrigatório; sem ela o LLM fica desligado e tudo cai no fallback):

  LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_REASONING_EFFORT
      provedor principal (padrão: Groq, https://api.groq.com/openai/v1)

  LLM_REVISOR_MODEL (+ opcionais LLM_REVISOR_API_KEY / _BASE_URL / _REASONING_EFFORT)
      modelo do revisor independente de questões (exercicios._revisar). Sem chave/URL
      próprias, usa as do principal. Na Groq o limite gratuito é POR MODELO, então pôr o
      revisor em outro modelo (ex.: qwen/qwen3.8-27b) dobra a capacidade sem custo — e um
      modelo de outra família erra de forma diferente, o que deixa a revisão mais confiável.

  LLM_RESERVA_API_KEY / LLM_RESERVA_BASE_URL / LLM_RESERVA_MODEL (+ _REASONING_EFFORT)
      provedor de reserva, também gratuito (ex.: Gemini no Google AI Studio, sem cartão).
      Entra quando o principal falha ou esgota a cota do dia.

Usa só a biblioteca padrão (urllib). Qualquer erro (sem chave, timeout, cota, rede) faz
`gerar` devolver None, e quem chamou usa o texto pronto. A demo nunca quebra por causa do LLM.
"""
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
# Modelos "thinking" gastam tokens de raciocínio ANTES da resposta, e esses tokens contam no
# max_tokens. "none" desliga o raciocínio onde existe; vazio ("") remove o campo da requisição.
REASONING_EFFORT = os.environ.get("LLM_REASONING_EFFORT", "none")
TIMEOUT = 30
# Só a geração em lote (app/bncc/gerar_perguntas.py) liga isto: em vez de falhar no limite
# por minuto do provedor (HTTP 429), espera e tenta de novo. Requisições ao vivo nunca esperam.
ESPERAR_LIMITE = False
# Espera acima disto (ou mensagem de limite diário) = cota do dia esgotada: passa para o próximo.
_ESPERA_MAXIMA = 120


class CotaEsgotada(Exception):
    """Todos os provedores de um papel esgotaram a cota do dia (só no modo lote)."""


@dataclass
class Provedor:
    nome: str
    api_key: str
    base_url: str
    modelo: str
    raciocinio: str
    esgotado: bool = False  # cota diária acabou nesta execução


def _raciocinio_padrao_revisor(modelo: str) -> str:
    """O revisor precisa pensar antes de julgar; o valor aceito muda conforme o modelo."""
    m = modelo.lower()
    if "gpt-oss" in m:
        return "high"
    if "qwen" in m:
        return "default"
    return ""  # provedores sem o parâmetro (ou que o rejeitam)


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
    elif principal:  # sem modelo próprio, o revisor é o principal pensando mais
        revisor = Provedor("revisor", API_KEY, BASE_URL, MODEL, _raciocinio_padrao_revisor(MODEL))
    geral = [p for p in (principal, reserva) if p]
    rev = [p for p in (revisor, reserva) if p]
    return geral, rev


_GERAL, _REVISOR = _montar()


def disponivel() -> bool:
    return bool(_GERAL)


def modelos() -> dict[str, str]:
    """Para registrar no arquivo de questões quem gerou e quem revisou."""
    return {"gerador": _GERAL[0].modelo if _GERAL else "", "revisor": _REVISOR[0].modelo if _REVISOR else ""}


def _cota_diaria(e: urllib.error.HTTPError, espera: float) -> bool:
    try:
        corpo = e.read().decode("utf-8", "ignore").lower()
    except Exception:
        corpo = ""
    return espera > _ESPERA_MAXIMA or "per day" in corpo or "daily" in corpo or "per_day" in corpo


def _chamar(p: Provedor, corpo: dict) -> str | None:
    """Uma chamada (com esperas de limite por minuto no modo lote). Marca `p.esgotado` se a
    cota do dia acabou. Devolve o texto ou None."""
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
            time.sleep(espera + 1)  # limite por minuto: espera e tenta de novo
        except Exception:
            return None  # falha graciosa: quem chamou decide o fallback
    return None


def gerar(sistema: str, mensagens: list[dict], temperatura: float = 0.4, max_tokens: int = 500,
          papel: str = "geral") -> str | None:
    """Chama o chat completions. `mensagens` é [{'role': 'user'|'assistant', 'content': ...}].
    `papel="revisor"` usa o modelo do revisor. Tenta os provedores do papel em ordem (principal,
    depois reserva). Devolve o texto, ou None. No modo lote, se todos esgotaram a cota do dia,
    levanta CotaEsgotada para o lote parar em vez de queimar horas tentando."""
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
