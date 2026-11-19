from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String, Text
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


class EstadoTemporario(Base):
    __tablename__ = "estado_temporario"
    chave: Mapped[str] = mapped_column(String, primary_key=True)
    dono: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    valor: Mapped[str] = mapped_column(Text)
    expira_em: Mapped[float] = mapped_column(Float, index=True)


class PerguntaTurma(Base):
    __tablename__ = "perguntas_turma"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    turma_id: Mapped[str] = mapped_column(ForeignKey("turmas.id"), index=True)
    habilidade_id: Mapped[str] = mapped_column(ForeignKey("habilidades.id"))
    nivel: Mapped[str] = mapped_column(String)
    tipo: Mapped[str] = mapped_column(String)
    enunciado: Mapped[str] = mapped_column(Text)
    instrucao: Mapped[str | None] = mapped_column(Text, nullable=True)
    frase: Mapped[str | None] = mapped_column(Text, nullable=True)
    opcoes: Mapped[str] = mapped_column(Text)
    certa: Mapped[int] = mapped_column(Integer)
    explicacao: Mapped[str] = mapped_column(Text, default="")
    origem: Mapped[str] = mapped_column(String)
    revisao: Mapped[str | None] = mapped_column(Text, nullable=True)
    autor_email: Mapped[str] = mapped_column(String)
    criada_em: Mapped[str] = mapped_column(String)


class Trilha(Base):
    __tablename__ = "trilhas"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    turma_id: Mapped[str] = mapped_column(ForeignKey("turmas.id"), index=True)
    disciplina_id: Mapped[str] = mapped_column(String)
    titulo: Mapped[str] = mapped_column(String)
    habilidades: Mapped[str] = mapped_column(Text)
    perguntas: Mapped[str] = mapped_column(Text)
    inicio: Mapped[str | None] = mapped_column(String, nullable=True)
    fim: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    autor_email: Mapped[str] = mapped_column(String)
    criada_em: Mapped[str] = mapped_column(String)


class TrilhaConclusao(Base):
    __tablename__ = "trilhas_conclusoes"
    trilha_id: Mapped[str] = mapped_column(ForeignKey("trilhas.id"), primary_key=True)
    aluno_id: Mapped[str] = mapped_column(ForeignKey("alunos.id"), primary_key=True)
    concluida_em: Mapped[str] = mapped_column(String)
    acertos: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    vezes: Mapped[int] = mapped_column(Integer, default=1)

