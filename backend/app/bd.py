from __future__ import annotations

import os
import time
from contextvars import ContextVar

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.environ.get("DATABASE_URL")


PASTA_BACKEND = Path(__file__).resolve().parent.parent


def _normaliza(url: str) -> str:
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
        caminho = url.removeprefix("sqlite:///")
        if caminho and caminho != ":memory:" and not Path(caminho).is_absolute():
            return f"sqlite:///{(PASTA_BACKEND / caminho).as_posix()}"
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


EM_MEMORIA = not DATABASE_URL

url = _normaliza(DATABASE_URL) if DATABASE_URL else "sqlite://"
if url.startswith("sqlite"):
    extra = {"poolclass": StaticPool} if EM_MEMORIA else {}
    engine = create_engine(url, future=True, connect_args={"check_same_thread": False}, **extra)

    @event.listens_for(engine, "connect")
    def _pragmas(conexao, _registro):
        cur = conexao.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        if not EM_MEMORIA:
            cur.execute("PRAGMA journal_mode=WAL")
        cur.close()
else:
    engine = create_engine(url, pool_pre_ping=True, future=True, connect_args={"connect_timeout": 10, "prepare_threshold": None})
medicao: ContextVar[dict | None] = ContextVar("medicao", default=None)


@event.listens_for(engine, "before_cursor_execute")
def _inicio_consulta(conexao, *_):
    conexao.info["inicio_consulta"] = time.perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _fim_consulta(conexao, *_):
    atual = medicao.get()
    if atual is not None:
        atual["consultas"] += 1
        atual["banco_s"] += time.perf_counter() - conexao.info.pop("inicio_consulta", time.perf_counter())


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def descricao() -> str:
    if EM_MEMORIA:
        return "memória"
    return "sqlite" if engine.dialect.name == "sqlite" else engine.dialect.name
