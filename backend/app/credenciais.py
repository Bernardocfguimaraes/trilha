"""Credenciais curtas devolvidas quando o PIN do aluno confere.

Valem para o aluno abrir sessões e para o responsável ver o progresso daquele aluno.
São aleatórias (não carregam o id do aluno), expiram e são revogadas quando o professor
troca o PIN. Ficam em memória nos dois modos (estado e banco): reiniciar a API pede o
PIN de novo, o que é o comportamento esperado para algo tão sensível.
"""
from __future__ import annotations

import secrets
import time

VALIDADE_S = 8 * 60 * 60  # um dia de aula

_por_credencial: dict[str, tuple[str, float]] = {}  # credencial -> (aluno_id, expira_em)


def emitir(aluno_id: str) -> str:
    _limpar_vencidas()
    credencial = secrets.token_urlsafe(32)
    _por_credencial[credencial] = (aluno_id, time.time() + VALIDADE_S)
    return credencial


def dono(credencial: str | None) -> str | None:
    """De qual aluno é a credencial; None se não existe, venceu ou foi revogada."""
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
    """Id de sessão de quiz impossível de adivinhar (antes era o horário em ms)."""
    return "s" + secrets.token_urlsafe(16)
