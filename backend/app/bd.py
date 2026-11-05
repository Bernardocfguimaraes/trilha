"""Conexão com o banco: SQLite (arquivo local) ou Postgres (Supabase).

Lê DATABASE_URL do ambiente (.env). Sem essa variável, o app usa um SQLite em memória
(populado com a demo ao subir e perdido ao reiniciar): assim existe uma camada de dados só.

- `sqlite:///trilha.db` → um arquivo dentro de backend/, sem servidor e sem internet.
  É o modo para apresentar em redes que bloqueiam a porta do Postgres. Caminho relativo
  é sempre resolvido a partir de backend/, não da pasta de onde o comando foi rodado.
- `postgresql://...` (Supabase) → forçamos o driver psycopg v3 (`postgresql+psycopg://`).

As tabelas (modelos.py) só usam tipos genéricos, então o mesmo código serve aos dois.
"""
from __future__ import annotations

import os

from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

try:
    # Carrega backend/.env automaticamente, se o python-dotenv estiver instalado.
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
    if url.startswith("postgres://"):  # algumas plataformas usam esse prefixo
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


EM_MEMORIA = not DATABASE_URL

url = _normaliza(DATABASE_URL) if DATABASE_URL else "sqlite://"
if url.startswith("sqlite"):
    # O FastAPI atende cada requisição numa thread do pool; o SQLite precisa ser avisado
    # de que a conexão pode trocar de thread. Em memória, uma conexão só (StaticPool),
    # senão cada conexão nova veria um banco vazio.
    extra = {"poolclass": StaticPool} if EM_MEMORIA else {}
    engine = create_engine(url, future=True, connect_args={"check_same_thread": False}, **extra)

    @event.listens_for(engine, "connect")
    def _pragmas(conexao, _registro):
        cur = conexao.cursor()
        cur.execute("PRAGMA foreign_keys=ON")  # o SQLite só checa chaves estrangeiras se pedirmos
        if not EM_MEMORIA:
            cur.execute("PRAGMA journal_mode=WAL")  # leituras não esperam a escrita terminar
        cur.close()
else:
    # connect_timeout: se a porta estiver bloqueada pela rede, falha rápido em vez de pendurar.
    engine = create_engine(url, pool_pre_ping=True, future=True, connect_args={"connect_timeout": 10})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def tem_banco() -> bool:
    return True


def descricao() -> str:
    """Qual banco está em uso, para logs e para a rota /saude (sem expor senha)."""
    if EM_MEMORIA:
        return "memória"
    return "sqlite" if engine.dialect.name == "sqlite" else engine.dialect.name
