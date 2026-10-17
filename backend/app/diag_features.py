"""Extração de features para o diagnóstico de dificuldade (passo 3).

A MESMA função é usada no treino (ml/treinar.py) e na inferência (app/diagnostico.py),
para garantir que o modelo veja exatamente as mesmas features nos dois momentos.

Entrada: uma série de desempenho por habilidade — lista de {"data": str, "desempenho": int}
na ordem cronológica (é o que estado.py e repo.py já produzem em `_serie`).

Só usa a biblioteca padrão (statistics) — nada de numpy/pandas — para a inferência rodar
em qualquer máquina sem instalar nada.
"""
from __future__ import annotations

from statistics import mean, pstdev

# Ordem fixa das features (o JSON do modelo guarda esta mesma ordem).
NOMES = ["media", "recente", "inicial", "tendencia", "desvio", "minimo", "n_dias"]


def extrair(serie: list[dict]) -> list[float]:
    """Vetor de features a partir da série de desempenho de uma habilidade."""
    vals = [float(p["desempenho"]) for p in serie]
    if not vals:
        return [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

    recente = mean(vals[-3:])          # desempenho recente (últimos 3 registros)
    inicial = mean(vals[:3])           # desempenho no começo da série
    return [
        round(mean(vals), 2),          # media geral
        round(recente, 2),             # media recente
        round(inicial, 2),             # media inicial
        round(recente - inicial, 2),   # tendência (melhora/piora)
        round(pstdev(vals), 2) if len(vals) > 1 else 0.0,  # consistência
        float(min(vals)),              # pior dia
        float(len(vals)),              # volume de dados
    ]
