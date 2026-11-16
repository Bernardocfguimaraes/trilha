from __future__ import annotations

from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field

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


class PedidoAvaliacao(BaseModel):
    status: Literal["ok", "atencao", "alerta"]


class PedidoPin(BaseModel):
    alunoId: Id
    pin: str = Field(pattern=r"^\d{4}$")


class PedidoProgresso(BaseModel):
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
    evitar: list[Annotated[str, Field(max_length=600)]] = Field(default=[], max_length=12)
