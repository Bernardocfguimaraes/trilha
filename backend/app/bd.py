"""Conexão com o banco (Postgres do Supabase).

Lê DATABASE_URL do ambiente (.env). Sem essa variável, `engine` fica None e o app
usa o estado em memória (app/estado.py) — mesmo padrão mock/real do frontend.

A connection string do Supabase vem como `postgresql://...`; aqui forçamos o driver
psycopg v3 (`postgresql+psycopg://...`), que é o que está instalado.
"""
from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    # Carrega backend/.env automaticamente, se o python-dotenv estiver instalado.
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

DATABASE_URL = os.environ.get("DATABASE_URL")


def _normaliza(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):  # algumas plataformas usam esse prefixo
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


engine = None
SessionLocal = None

if DATABASE_URL:
    engine = create_engine(_normaliza(DATABASE_URL), pool_pre_ping=True, future=True)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def tem_banco() -> bool:
    return engine is not None
