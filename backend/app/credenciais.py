from __future__ import annotations

import secrets
import time

VALIDADE_S = 8 * 60 * 60

_por_credencial: dict[str, tuple[str, float]] = {}


def emitir(aluno_id: str) -> str:
    _limpar_vencidas()
    credencial = secrets.token_urlsafe(32)
    _por_credencial[credencial] = (aluno_id, time.time() + VALIDADE_S)
    return credencial


def dono(credencial: str | None) -> str | None:
    if not credencial:
        return None
    item = _por_credencial.get(credencial)
    if not item:
        return None
    aluno_id, expira = item
    if expira < time.time():
        _por_credencial.pop(credencial, None)
        return None
    return aluno_id


def revogar_aluno(aluno_id: str) -> None:
    for c in [c for c, (a, _) in _por_credencial.items() if a == aluno_id]:
        _por_credencial.pop(c, None)


def _limpar_vencidas() -> None:
    agora = time.time()
    for c in [c for c, (_, e) in _por_credencial.items() if e < agora]:
        _por_credencial.pop(c, None)


def novo_id_sessao() -> str:
    return "s" + secrets.token_urlsafe(16)
