from __future__ import annotations

from statistics import mean, pstdev

NOMES = ["media", "recente", "inicial", "tendencia", "desvio", "minimo", "n_dias", "projecao", "variacao"]


def _reta(vals: list[float]) -> tuple[float, float]:
    n = len(vals)
    if n < 2:
        return vals[-1], 0.0
    xm = (n - 1) / 2
    ym = mean(vals)
    sxx = sum((i - xm) ** 2 for i in range(n))
    inclinacao = sum((i - xm) * (v - ym) for i, v in enumerate(vals)) / sxx
    return ym + inclinacao * (n - 1 - xm), inclinacao * (n - 1)


def extrair(serie: list[dict]) -> list[float]:
    vals = [float(p["desempenho"]) for p in serie]
    if not vals:
        return [0.0] * len(NOMES)

    recente = mean(vals[-3:])
    projecao, variacao = _reta(vals)
    inicial = mean(vals[:3])
    return [
        round(mean(vals), 2),
        round(recente, 2),
        round(inicial, 2),
        round(recente - inicial, 2),
        round(pstdev(vals), 2) if len(vals) > 1 else 0.0,
        float(min(vals)),
        float(len(vals)),
        round(max(0.0, min(100.0, projecao)), 2),
        round(variacao, 2),
    ]
