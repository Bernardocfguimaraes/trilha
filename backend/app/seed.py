"""Cria as tabelas e popula com os dados da demo — o mesmo conteúdo do mock do passo 1,
agora persistido. Rodar uma vez após configurar o DATABASE_URL (SQLite ou Postgres):

    python -m app.seed

É idempotente: derruba e recria as tabelas, então pode rodar de novo para "resetar" a demo.
Isso apaga sessões feitas depois do seed — use só quando quiser voltar ao estado inicial.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from . import bd, seguranca
from .dados import ALUNOS, DISCIPLINAS, HABILIDADES, PINS_INICIAIS, STATUS_INICIAL, TURMA
from .modelos import (
    Aluno,
    AlunoHabilidadeStatus,
    Base,
    Disciplina,
    Habilidade,
    Historico,
    Professor,
    Turma,
    TurmaDisciplinaAtiva,
    TurmaHabilidadeAtiva,
)


def _arred(x: float) -> int:
    return math.floor(x + 0.5)


def _id_disciplina_por_nome(nome: str) -> str:
    for d in DISCIPLINAS:
        if d["nome"] == nome:
            return d["id"]
    raise ValueError(f"disciplina sem id: {nome}")


def _historico_sintetico(a: dict) -> list[dict]:
    """Mesma geração do mock (sessoesIniciais): sessões anteriores coerentes com o status."""
    if not a["ultima"]:
        return []
    datas: list[str] = []
    passo = [3, 4] if a["id"] == "a2" else [7]
    d = datetime(2026, 8, 24, tzinfo=timezone.utc).date()
    fim = datetime.fromisoformat(a["ultima"]).date()
    i = 0
    while d <= fim:
        datas.append(d.isoformat())
        d = d + timedelta(days=passo[i % len(passo)])
        i += 1
    alvo = {"ok": 82, "atencao": 61, "alerta": 42}
    linhas = []
    for idx, data in enumerate(datas):
        t = idx / max(len(datas) - 1, 1)
        for hi, h in enumerate(HABILIDADES):
            status = STATUS_INICIAL[a["id"]].get(h["id"])
            if status is None:
                continue  # ainda não praticada na demo: sem histórico
            inicio = 58 + (hi % 3) * 6 if status == "ok" else 55 if status == "atencao" else 60
            ruido = ((hi * 7 + idx * 13) % 9) - 4
            val = max(0, min(100, _arred(inicio + (alvo[status] - inicio) * t + ruido)))
            linhas.append({"habilidade_id": h["id"], "data": data, "desempenho": val})
    return linhas


def semear() -> None:
    if not bd.tem_banco():
        raise SystemExit("DATABASE_URL não definido. Configure o .env antes de rodar o seed.")

    Base.metadata.drop_all(bd.engine)
    Base.metadata.create_all(bd.engine)

    with bd.SessionLocal() as s:
        s.add(Turma(id=TURMA["id"], nome=TURMA["nome"], codigo=TURMA["codigo"], ciclo="4º bimestre de 2026", ano=TURMA["ano"]))
        s.flush()  # turma antes das disciplinas/habilidades/alunos que apontam para ela

        for ordem, d in enumerate(DISCIPLINAS):
            s.add(Disciplina(id=d["id"], nome=d["nome"], ordem=ordem))
        s.flush()

        for ordem, h in enumerate(HABILIDADES):
            s.add(Habilidade(
                id=h["id"], nome=h["nome"], disciplina_id=_id_disciplina_por_nome(h["disciplina"]),
                descricao=h["descricao"], ordem=ordem, codigo_bncc=h["codigoBncc"], unidade=h["unidade"],
            ))
        s.flush()

        # Disciplinas e habilidades (avaliáveis) ativas: todas.
        for d in DISCIPLINAS:
            s.add(TurmaDisciplinaAtiva(turma_id=TURMA["id"], disciplina_id=d["id"]))
        for h in HABILIDADES:
            s.add(TurmaHabilidadeAtiva(turma_id=TURMA["id"], habilidade_id=h["id"]))
        s.flush()

        for a in ALUNOS:
            s.add(Aluno(id=a["id"], turma_id=TURMA["id"], nome=a["nome"], pin=PINS_INICIAIS[a["id"]], ultima_atividade=a["ultima"]))
            # Status inicial só das habilidades já praticadas na demo.
            for hid, status in STATUS_INICIAL[a["id"]].items():
                s.add(AlunoHabilidadeStatus(aluno_id=a["id"], habilidade_id=hid, status=status))
            # Histórico sintético.
            for linha in _historico_sintetico(a):
                s.add(Historico(aluno_id=a["id"], habilidade_id=linha["habilidade_id"], data=linha["data"], desempenho=linha["desempenho"]))

        # Conta do professor (do .env), com a senha só em hash.
        conta = seguranca.professor_do_env()
        if conta:
            s.add(Professor(email=conta["email"], nome=conta["nome"], senha_hash=seguranca.hash_senha(conta["senha"])))

        s.commit()

    print(f"Seed concluído ({bd.descricao()}): tabelas criadas e populadas.")


if __name__ == "__main__":
    semear()
