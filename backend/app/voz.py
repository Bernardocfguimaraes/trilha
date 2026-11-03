"""Transcrição de voz (STT) via Whisper na Groq (passo 6).

A professora grava um áudio curto; o backend manda para o Whisper (mesma chave e endpoint
da Groq já usados em llm.py) e devolve o texto. Usa só a biblioteca padrão (urllib),
montando o corpo multipart/form-data na mão — nenhuma dependência nova no cliente HTTP.
Qualquer falha devolve None, e quem chamou trata (nada quebra).
"""
from __future__ import annotations

import json
import urllib.request
import uuid

from . import llm

MODELO_STT = "whisper-large-v3-turbo"
TIMEOUT = 60


def disponivel() -> bool:
    return bool(llm.API_KEY)


def _corpo_multipart(campos: dict[str, str], filename: str, dados: bytes, content_type: str) -> tuple[bytes, str]:
    """Monta um corpo multipart/form-data (campos de texto + um arquivo no campo 'file')."""
    boundary = "----trilha" + uuid.uuid4().hex
    corpo = bytearray()
    for nome, valor in campos.items():
        corpo += f"--{boundary}\r\n".encode()
        corpo += f'Content-Disposition: form-data; name="{nome}"\r\n\r\n'.encode()
        corpo += f"{valor}\r\n".encode()
    corpo += f"--{boundary}\r\n".encode()
    corpo += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    corpo += f"Content-Type: {content_type}\r\n\r\n".encode()
    corpo += dados
    corpo += f"\r\n--{boundary}--\r\n".encode()
    return bytes(corpo), boundary


def transcrever(dados: bytes, filename: str = "audio.webm", content_type: str = "audio/webm") -> str | None:
    """Transcreve o áudio (bytes) para texto em português. None se o LLM não estiver
    configurado ou a chamada falhar."""
    if not llm.API_KEY or not dados:
        return None
    corpo, boundary = _corpo_multipart(
        {"model": MODELO_STT, "language": "pt", "response_format": "json"},
        filename,
        dados,
        content_type,
    )
    req = urllib.request.Request(
        f"{llm.BASE_URL}/audio/transcriptions",
        data=corpo,
        headers={
            "Authorization": f"Bearer {llm.API_KEY}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": "trilha-backend/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            out = json.loads(resp.read().decode("utf-8"))
        texto = (out.get("text") or "").strip()
        return texto or None
    except Exception:
        # Falha graciosa: cota, rede, formato de áudio não aceito, etc.
        return None
