from __future__ import annotations

import secrets

from . import estado

VALIDADE_S = 8 * 60 * 60
_PREFIXO = "acesso:"


def emitir(aluno_id: str) -> str:
    estado.limpar_vencidos()
    credencial = secrets.token_urlsafe(32)
    estado.gravar(_PREFIXO + credencial, aluno_id, VALIDADE_S, dono=aluno_id)
    return credencial


def dono(credencial: str | None) -> str | None:
    if not credencial:
        return None
    return estado.ler(_PREFIXO + credencial)


def revogar_aluno(aluno_id: str) -> None:
    estado.apagar_do_dono(_PREFIXO, aluno_id)


def novo_id_sessao() -> str:
    return "s" + secrets.token_urlsafe(16)
