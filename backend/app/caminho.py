"""Regras do "caminho" (trilha ordenada de habilidades BNCC por ano/disciplina).

Funções puras, usadas tanto pelo estado em memória (estado.py) quanto pelo Postgres
(repo.py), para as duas fontes não divergirem.

- Uma habilidade está CONCLUÍDA quando o diagnóstico diz "ok" e já há pelo menos
  REGISTROS_PARA_CONCLUIR dias de desempenho nela (um acerto isolado não conclui).
- A sessão do aluno trabalha a "frente" do caminho: as próximas TAMANHO_FRENTE habilidades
  não concluídas, na ordem, mais uma revisão de alguma já iniciada que esteja em alerta.
  Assim cada habilidade acumula dados suficientes para o diagnóstico de ML.
"""
from __future__ import annotations

REGISTROS_PARA_CONCLUIR = 3
TAMANHO_FRENTE = 3

# info: habilidade_id -> (status atual ou None se nunca praticou, nº de dias com registro)
Info = dict[str, tuple[str | None, int]]


def concluida(status: str | None, n_registros: int) -> bool:
    return status == "ok" and n_registros >= REGISTROS_PARA_CONCLUIR


def _pendentes(ordem: list[str], info: Info) -> list[str]:
    return [h for h in ordem if not concluida(*info.get(h, (None, 0)))]


def frente(ordem: list[str], info: Info) -> list[str]:
    """Habilidades da próxima sessão, na ordem do caminho."""
    if not ordem:
        return []
    pendentes = _pendentes(ordem, info)
    if not pendentes:  # caminho concluído: revisa as últimas
        return ordem[-TAMANHO_FRENTE:]
    escolhidas = pendentes[:TAMANHO_FRENTE]
    revisao = [h for h in ordem if info.get(h, (None, 0))[0] == "alerta" and h not in escolhidas]
    return escolhidas + revisao[:1]


def progresso(ordem: list[str], info: Info) -> dict:
    """Quantas concluídas, a habilidade atual (primeira pendente) e as próximas."""
    pendentes = _pendentes(ordem, info)
    return {
        "total": len(ordem),
        "concluidas": len(ordem) - len(pendentes),
        "atual": pendentes[0] if pendentes else None,
        "proximas": pendentes[1:TAMANHO_FRENTE],
    }


def formatar_progresso(disciplina_id: str, disciplina_nome: str, ano: int, p: dict, habs: dict[str, dict]) -> dict:
    """Progresso no formato da API (ProgressoCaminho em src/lib/types.ts)."""
    def ref(hid: str | None) -> dict | None:
        if hid is None:
            return None
        h = habs[hid]
        return {"habilidadeId": hid, "nome": h["nome"], "codigoBncc": h.get("codigoBncc")}

    return {
        "disciplinaId": disciplina_id,
        "disciplina": disciplina_nome,
        "ano": ano,
        "total": p["total"],
        "concluidas": p["concluidas"],
        "atual": ref(p["atual"]),
        "proximas": [ref(h) for h in p["proximas"]],
    }
