"""Corpos de requisição (Pydantic). Os campos usam exatamente os nomes que o frontend
envia (camelCase), para o JSON casar sem apelidos. As respostas são montadas como dicts
em estado.py, com as mesmas chaves que o contrato em src/lib/types.ts define.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

Nivel = Literal["facil", "medio", "dificil"]
AutorMensagem = Literal["professor", "assistente"]


class PedidoPin(BaseModel):
    alunoId: str
    pin: str


class PedidoSessao(BaseModel):
    codigo: str
    alunoId: str
    acesso: Optional[str] = None
    disciplinaId: Optional[str] = None


class PedidoResposta(BaseModel):
    perguntaId: str
    opcaoId: str


class PedidoTurmaConfig(BaseModel):
    habilidadesAtivas: list[str]
    disciplinasAtivas: Optional[list[str]] = None


class MensagemChat(BaseModel):
    id: str
    autor: AutorMensagem
    texto: str
    enviadaEm: str


class PedidoChatTurma(BaseModel):
    pergunta: str
    historico: list[MensagemChat] = []
