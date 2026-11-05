"""Corpos de requisição (Pydantic). Os campos usam exatamente os nomes que o frontend
envia (camelCase), para o JSON casar sem apelidos. As respostas são montadas como dicts
em repo.py, com as mesmas chaves que o contrato em src/lib/types.ts define.
"""
from __future__ import annotations

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

# Limites de tamanho em tudo que vem de fora: nada de corpo gigante ou texto sem fim
# chegando ao banco ou ao LLM.
Id = Annotated[str, Field(min_length=1, max_length=64)]
Nivel = Literal["facil", "medio", "dificil"]
AutorMensagem = Literal["professor", "assistente"]


class PedidoLogin(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    senha: str = Field(min_length=1, max_length=200)


NomePessoa = Annotated[str, Field(min_length=2, max_length=80)]


class PedidoNovaTurma(BaseModel):
    nome: str = Field(min_length=1, max_length=40)
    ano: int = Field(ge=4, le=9)
    alunos: list[NomePessoa] = Field(default=[], max_length=60)


class PedidoNovoAluno(BaseModel):
    nome: NomePessoa


class PedidoPin(BaseModel):
    alunoId: Id
    pin: str = Field(pattern=r"^\d{4}$")


class PedidoProgresso(BaseModel):
    # Credencial devolvida por /acesso/pin; vai no corpo (não na URL) para não cair em logs.
    acesso: str = Field(min_length=1, max_length=128)


class PedidoSessao(BaseModel):
    codigo: str = Field(min_length=1, max_length=16)
    alunoId: Id
    acesso: Optional[str] = Field(default=None, max_length=128)
    disciplinaId: Optional[str] = Field(default=None, max_length=64)


class PedidoResposta(BaseModel):
    perguntaId: Id
    opcaoId: str = Field(min_length=1, max_length=128)


class PedidoTurmaConfig(BaseModel):
    habilidadesAtivas: list[str] = Field(max_length=1000)
    disciplinasAtivas: Optional[list[str]] = Field(default=None, max_length=50)


class MensagemChat(BaseModel):
    id: str = Field(max_length=64)
    autor: AutorMensagem
    texto: str = Field(max_length=6000)
    enviadaEm: str = Field(max_length=40)


class PedidoChatTurma(BaseModel):
    pergunta: str = Field(min_length=1, max_length=1500)
    historico: list[MensagemChat] = Field(default=[], max_length=40)


class PedidoExercicio(BaseModel):
    habilidadeId: Id
    nivel: Nivel = "medio"
