"""Exporta o dataset REAL: histórico dos alunos + avaliação do professor sobre o diagnóstico.

Cada vez que um professor responde "o diagnóstico está certo?" no painel, aquela habilidade
daquele aluno vira uma amostra rotulada: as mesmas features que o modelo usa (extraídas do
histórico real) e o status que o professor confirmou ou corrigiu.

Uso (com o DATABASE_URL do .env apontando para o banco da escola):
    python -m ml.exportar_reais      -> ml/dados_reais.csv
    python -m ml.treinar             -> usa o arquivo, se existir, e mede o ganho

O CSV não tem nomes, só ids internos, e fica fora do git (.gitignore).
"""
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
