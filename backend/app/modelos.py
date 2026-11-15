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
    ano: Mapped[int] = mapped_column(Integer, default=4)
    professor_email: Mapped[str | None] = mapped_column(String, nullable=True, index=True)


class Disciplina(Base):
    __tablename__ = "disciplinas"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    nome: Mapped[str] = mapped_column(String)
    ordem: Mapped[int] = mapped_column(Integer)


class Habilidade(Base):
    __tablename__ = "habilidades"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    nome: Mapped[str] = mapped_column(String)
    disciplina_id: Mapped[str] = mapped_column(ForeignKey("disciplinas.id"))
    descricao: Mapped[str] = mapped_column(Text)
    codigo_bncc: Mapped[str | None] = mapped_column(String, nullable=True)
    unidade: Mapped[str | None] = mapped_column(String, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer)
    disciplina: Mapped[Disciplina] = relationship()


class Aluno(Base):
    __tablename__ = "alunos"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    turma_id: Mapped[str] = mapped_column(ForeignKey("turmas.id"))
    nome: Mapped[str] = mapped_column(String)
    pin: Mapped[str] = mapped_column(String)
    ultima_atividade: Mapped[str | None] = mapped_column(String, nullable=True)


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
    status: Mapped[str] = mapped_column(String)


class Historico(Base):
    __tablename__ = "historico"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    aluno_id: Mapped[str] = mapped_column(ForeignKey("alunos.id"), index=True)
    habilidade_id: Mapped[str] = mapped_column(ForeignKey("habilidades.id"))
    data: Mapped[str] = mapped_column(String)
    desempenho: Mapped[int] = mapped_column(Integer)


class Professor(Base):
    __tablename__ = "professores"
    email: Mapped[str] = mapped_column(String, primary_key=True)
    nome: Mapped[str] = mapped_column(String)
    senha_hash: Mapped[str] = mapped_column(String)


class RotuloProfessor(Base):
    __tablename__ = "rotulos_professor"
    aluno_id: Mapped[str] = mapped_column(ForeignKey("alunos.id"), primary_key=True)
    habilidade_id: Mapped[str] = mapped_column(ForeignKey("habilidades.id"), primary_key=True)
    status: Mapped[str] = mapped_column(String)
    status_modelo: Mapped[str] = mapped_column(String)
    professor_email: Mapped[str] = mapped_column(String)
    criado_em: Mapped[str] = mapped_column(String)
