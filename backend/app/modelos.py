"""Modelos SQLAlchemy (tabelas do Postgres).

Guardam o que precisa sobreviver a um restart: turma, alunos (com PIN), disciplinas,
habilidades, quais estão ativas no ciclo, o status atual por habilidade e o histórico
de desempenho. O banco de perguntas (conteúdo do app) continua em dados.py por enquanto;
a sessão de quiz em andamento e as tentativas de PIN ficam em memória (são transitórias).
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Turma(Base):
    __tablename__ = "turmas"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    nome: Mapped[str] = mapped_column(String)
    codigo: Mapped[str] = mapped_column(String, unique=True, index=True)
    ciclo: Mapped[str] = mapped_column(String)


class Disciplina(Base):
    __tablename__ = "disciplinas"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # "por", "mat", ...
    nome: Mapped[str] = mapped_column(String)
    ordem: Mapped[int] = mapped_column(Integer)  # ordem de exibição para o aluno


class Habilidade(Base):
    __tablename__ = "habilidades"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # "mat-adicao", ...
    nome: Mapped[str] = mapped_column(String)
    disciplina_id: Mapped[str] = mapped_column(ForeignKey("disciplinas.id"))
    descricao: Mapped[str] = mapped_column(Text)
    ordem: Mapped[int] = mapped_column(Integer)  # ordem dentro da matriz (casa com a demo)
    disciplina: Mapped[Disciplina] = relationship()


class Aluno(Base):
    __tablename__ = "alunos"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    turma_id: Mapped[str] = mapped_column(ForeignKey("turmas.id"))
    nome: Mapped[str] = mapped_column(String)
    pin: Mapped[str] = mapped_column(String)  # 4 dígitos; regenerável pelo professor
    ultima_atividade: Mapped[str | None] = mapped_column(String, nullable=True)  # ISO date


class TurmaDisciplinaAtiva(Base):
    __tablename__ = "turma_disciplina_ativa"
    turma_id: Mapped[str] = mapped_column(ForeignKey("turmas.id"), primary_key=True)
    disciplina_id: Mapped[str] = mapped_column(ForeignKey("disciplinas.id"), primary_key=True)


class TurmaHabilidadeAtiva(Base):
    __tablename__ = "turma_habilidade_ativa"
    turma_id: Mapped[str] = mapped_column(ForeignKey("turmas.id"), primary_key=True)
    habilidade_id: Mapped[str] = mapped_column(ForeignKey("habilidades.id"), primary_key=True)


class AlunoHabilidadeStatus(Base):
    __tablename__ = "aluno_habilidade_status"
    aluno_id: Mapped[str] = mapped_column(ForeignKey("alunos.id"), primary_key=True)
    habilidade_id: Mapped[str] = mapped_column(ForeignKey("habilidades.id"), primary_key=True)
    status: Mapped[str] = mapped_column(String)  # "ok" | "atencao" | "alerta"


class Historico(Base):
    __tablename__ = "historico"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    aluno_id: Mapped[str] = mapped_column(ForeignKey("alunos.id"), index=True)
    habilidade_id: Mapped[str] = mapped_column(ForeignKey("habilidades.id"))
    data: Mapped[str] = mapped_column(String)  # ISO date (YYYY-MM-DD)
    desempenho: Mapped[int] = mapped_column(Integer)  # 0–100
