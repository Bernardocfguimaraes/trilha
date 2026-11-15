from __future__ import annotations

import csv
import os
import random

from app.diag_features import NOMES, extrair
from ml.simulacao import trajetoria

N_AMOSTRAS = 4000
TENDENCIA_MAX = 30
SEMENTE = 42
ARQ = os.path.join(os.path.dirname(__file__), "dados_sinteticos.csv")


def _clip(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _rotulo(efetivo: float) -> str:
    base = "ok" if efetivo >= 70 else "atencao" if efetivo >= 55 else "alerta"
    if random.random() < 0.03:
        vizinho = {"ok": "atencao", "atencao": random.choice(["ok", "alerta"]), "alerta": "atencao"}
        return vizinho[base]
    return base


def gerar_uma():
    proficiencia = random.uniform(20, 95)
    tendencia = random.uniform(-TENDENCIA_MAX, TENDENCIA_MAX)
    n_dias = random.randint(3, 12)
    _, serie = trajetoria(_RNG, proficiencia, tendencia, n_dias)

    nivel_atual = _clip(proficiencia + tendencia)
    efetivo = _clip(nivel_atual + 1.3 * tendencia)
    return extrair(serie), _rotulo(efetivo)


_RNG = random.Random(SEMENTE)


def gerar():
    random.seed(SEMENTE)
    _RNG.seed(SEMENTE + 1)
    linhas = [gerar_uma() for _ in range(N_AMOSTRAS)]
    with open(ARQ, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(NOMES + ["status"])
        for feats, rotulo in linhas:
            w.writerow(feats + [rotulo])
    from collections import Counter
    dist = Counter(r for _, r in linhas)
    print(f"Gerado {ARQ} com {len(linhas)} amostras.")
    print("Distribuição:", dict(dist))


if __name__ == "__main__":
    gerar()
