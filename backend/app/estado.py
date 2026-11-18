from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy import delete

from . import bd
from .modelos import EstadoTemporario


def gravar(chave: str, valor: Any, validade_s: float, dono: str | None = None) -> None:
    with bd.SessionLocal() as s:
        s.merge(EstadoTemporario(chave=chave, dono=dono, valor=json.dumps(valor), expira_em=time.time() + validade_s))
        s.commit()


def ler(chave: str) -> Any:
    with bd.SessionLocal() as s:
        item = s.get(EstadoTemporario, chave)
        if item is None:
            return None
        if item.expira_em < time.time():
            s.delete(item)
            s.commit()
            return None
        return json.loads(item.valor)


def apagar(chave: str) -> None:
    with bd.SessionLocal() as s:
        s.execute(delete(EstadoTemporario).where(EstadoTemporario.chave == chave))
        s.commit()


def apagar_do_dono(prefixo: str, dono: str) -> None:
    with bd.SessionLocal() as s:
        s.execute(delete(EstadoTemporario).where(EstadoTemporario.dono == dono, EstadoTemporario.chave.startswith(prefixo)))
        s.commit()


def limpar_vencidos() -> None:
    with bd.SessionLocal() as s:
        s.execute(delete(EstadoTemporario).where(EstadoTemporario.expira_em < time.time()))
        s.commit()
