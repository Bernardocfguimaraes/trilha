from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Header

from . import estado
from .regras import ApiErro

ITERACOES = 200_000
VALIDADE_TOKEN_S = 12 * 60 * 60
MAX_ERROS_LOGIN = 5
ESPERA_BLOQUEIO_S = 5 * 60

_segredo_env = os.environ.get("TRILHA_SEGREDO", "").strip()
SEGREDO_TEMPORARIO = len(_segredo_env) < 32
_SEGREDO = (_segredo_env if not SEGREDO_TEMPORARIO else secrets.token_hex(32)).encode()


def hash_senha(senha: str, sal: bytes | None = None) -> str:
    sal = sal or secrets.token_bytes(16)
    chave = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal, ITERACOES)
    return f"pbkdf2_sha256${ITERACOES}${sal.hex()}${chave.hex()}"


def conferir_senha(senha: str, guardado: str) -> bool:
    try:
        algoritmo, iteracoes, sal_hex, chave_hex = guardado.split("$")
        if algoritmo != "pbkdf2_sha256":
            return False
        chave = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal_hex), int(iteracoes))
        return hmac.compare_digest(chave.hex(), chave_hex)
    except (ValueError, TypeError):
        return False


def _b64(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode()


def _de_b64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def emitir_token(email: str, nome: str) -> tuple[str, int]:
    expira = int(time.time()) + VALIDADE_TOKEN_S
    corpo = _b64(json.dumps({"sub": email, "nome": nome, "papel": "professor", "exp": expira}).encode())
    assinatura = _b64(hmac.new(_SEGREDO, corpo.encode(), hashlib.sha256).digest())
    return f"{corpo}.{assinatura}", expira


def ler_token(token: str) -> dict | None:
    try:
        corpo, assinatura = token.split(".")
        esperada = _b64(hmac.new(_SEGREDO, corpo.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(assinatura, esperada):
            return None
        dados = json.loads(_de_b64(corpo))
        if dados.get("papel") != "professor" or int(dados.get("exp", 0)) < time.time():
            return None
        return dados
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def professor_atual(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiErro(401, "Entre como professor para continuar.")
    dados = ler_token(authorization[7:].strip())
    if not dados:
        raise ApiErro(401, "Sua sessão expirou. Entre de novo.")
    return dados


def _chave_login(email: str) -> str:
    return "login:" + email


def bloqueado(email: str) -> bool:
    t = estado.ler(_chave_login(email))
    return bool(t and t["ate"] > time.time())


def registrar_erro(email: str) -> None:
    t = estado.ler(_chave_login(email)) or {"erros": 0, "ate": 0.0}
    t["erros"] += 1
    if t["erros"] >= MAX_ERROS_LOGIN:
        t["erros"] = 0
        t["ate"] = time.time() + ESPERA_BLOQUEIO_S
    estado.gravar(_chave_login(email), t, ESPERA_BLOQUEIO_S + 3600)


def limpar_erros(email: str) -> None:
    estado.apagar(_chave_login(email))


def professor_do_env() -> dict | None:
    email = os.environ.get("PROFESSOR_EMAIL", "").strip().lower()
    senha = os.environ.get("PROFESSOR_SENHA", "")
    if not email or len(senha) < 8:
        return None
    return {"email": email, "nome": os.environ.get("PROFESSOR_NOME", "Professor").strip() or "Professor", "senha": senha}
