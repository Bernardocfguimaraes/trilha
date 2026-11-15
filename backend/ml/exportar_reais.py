from __future__ import annotations

import csv
import os
from collections import Counter

from app import bd, repo
from app.diag_features import NOMES, extrair

ARQ = os.path.join(os.path.dirname(__file__), "dados_reais.csv")


def exportar(destino: str = ARQ) -> int:
    if bd.EM_MEMORIA:
        raise SystemExit("DATABASE_URL não definido: não há banco com dados reais para exportar.")
    amostras = repo.dados_reais()
    with open(destino, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["aluno_id", "habilidade_id"] + NOMES + ["status"])
        for a in amostras:
            w.writerow([a["aluno_id"], a["habilidade_id"]] + extrair(a["serie"]) + [a["status"]])
    print(f"{len(amostras)} amostras reais exportadas para {os.path.relpath(destino)}.")
    print("Distribuição (avaliação do professor):", dict(Counter(a["status"] for a in amostras)))
    return len(amostras)


if __name__ == "__main__":
    exportar()
