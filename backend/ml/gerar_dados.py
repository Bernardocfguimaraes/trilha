"""Gera o dataset sintético de treino (caminho A, combinado com o grupo).

Não existe base real de alunos da Trilha ainda, então simulamos o desempenho de forma
realista: cada aluno-habilidade tem uma proficiência "verdadeira" (latente) e uma tendência
(está melhorando ou piorando). A partir disso geramos uma série de desempenho diário com
RUÍDO, extraímos as mesmas features do app (app/diag_features.extrair) e rotulamos pela
proficiência latente — não pelos valores observados.

Por que isso é um problema de ML de verdade, e não um if/else disfarçado: o rótulo depende
da proficiência latente + tendência (onde o aluno vai chegar), enquanto o modelo só enxerga
valores observados ruidosos. Um limiar simples sobre a média erra, por exemplo, o aluno que
começou mal mas tem tendência forte de melhora. O modelo precisa aprender a combinar as
features (média recente, tendência, consistência) para recuperar o rótulo.

Uso: python -m ml.gerar_dados  ->  escreve ml/dados_sinteticos.csv
"""
from __future__ import annotations

import csv
import os
import random

from app.diag_features import NOMES, extrair

N_AMOSTRAS = 4000
SEMENTE = 42
ARQ = os.path.join(os.path.dirname(__file__), "dados_sinteticos.csv")


def _clip(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def _rotulo(efetivo: float) -> str:
    # Faixa do nível "efetivo" -> status, com um pouco de ruído perto das bordas.
    base = "ok" if efetivo >= 70 else "atencao" if efetivo >= 55 else "alerta"
    if random.random() < 0.03:  # 3% de ruído de rótulo (alunos não são determinísticos)
        vizinho = {"ok": "atencao", "atencao": random.choice(["ok", "alerta"]), "alerta": "atencao"}
        return vizinho[base]
    return base


def gerar_uma():
    proficiencia = random.uniform(20, 95)      # nível "real" de partida (latente)
    tendencia = random.uniform(-20, 20)        # melhora/piora ao longo do bimestre
    n_dias = random.randint(3, 12)
    serie = []
    for i in range(n_dias):
        progresso = i / max(n_dias - 1, 1)
        base = proficiencia + tendencia * progresso
        val = _clip(base + random.gauss(0, 6))  # ruído moderado por sessão
        serie.append({"data": f"d{i}", "desempenho": round(val)})

    # Rótulo: NÃO é só "onde a média caiu". A tendência pesa forte — um aluno que vem
    # subindo merece "ok" mesmo com média mediana; um que vem caindo merece cautela mesmo
    # com média ok. A média recente sozinha não enxerga para onde o aluno está indo; é isso
    # que o modelo aprende com a feature de tendência e a regra de limiar não captura.
    nivel_atual = _clip(proficiencia + tendencia)
    efetivo = _clip(nivel_atual + 1.3 * tendencia)
    return extrair(serie), _rotulo(efetivo)


def gerar():
    random.seed(SEMENTE)
    linhas = [gerar_uma() for _ in range(N_AMOSTRAS)]
    with open(ARQ, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(NOMES + ["status"])
        for feats, rotulo in linhas:
            w.writerow(feats + [rotulo])
    # Distribuição das classes, para conferência.
    from collections import Counter
    dist = Counter(r for _, r in linhas)
    print(f"Gerado {ARQ} com {len(linhas)} amostras.")
    print("Distribuição:", dict(dist))


if __name__ == "__main__":
    gerar()
