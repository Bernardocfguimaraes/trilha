"""Treina e avalia o diagnóstico de dificuldade, e exporta o modelo para o backend.

Pipeline de ML clássico (scikit-learn):
  1. carrega o dataset sintético (ml/dados_sinteticos.csv; gera se faltar)
  2. separa treino/teste
  3. treina dois modelos — Árvore de Decisão e Random Forest — e compara
  4. reporta acurácia, matriz de confusão, relatório por classe e importância das features
  5. exporta o Random Forest para app/modelo_diagnostico.json (inferência em Python puro no backend)
  6. salva o relatório em ml/relatorio_treino.txt

Uso: python -m ml.treinar
Requer scikit-learn + numpy (ml/requirements-treino.txt). O BACKEND não precisa deles:
ele lê o JSON e classifica sem scikit-learn.
"""
from __future__ import annotations

import csv
import json
import os

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from app.diag_features import NOMES

AQUI = os.path.dirname(__file__)
CSV = os.path.join(AQUI, "dados_sinteticos.csv")
RELATORIO = os.path.join(AQUI, "relatorio_treino.txt")
MODELO_JSON = os.path.join(AQUI, os.pardir, "app", "modelo_diagnostico.json")
CLASSES = ["alerta", "atencao", "ok"]  # ordem fixa


def carregar():
    if not os.path.exists(CSV):
        from ml.gerar_dados import gerar
        gerar()
    X, y = [], []
    with open(CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            X.append([float(row[n]) for n in NOMES])
            y.append(row["status"])
    return np.array(X), np.array(y)


def _exportar_arvore(tree) -> list[dict]:
    """Converte uma árvore do sklearn em nós simples {f,t,l,r} ou {leaf: classe}."""
    t = tree.tree_
    nos = []
    for i in range(t.node_count):
        if t.children_left[i] == t.children_right[i]:  # folha
            contagem = t.value[i][0]
            total = float(contagem.sum()) or 1.0
            # Guarda a distribuição de probabilidade (voto suave, igual ao sklearn).
            nos.append({"p": [round(float(c) / total, 6) for c in contagem]})
        else:
            nos.append({"f": int(t.feature[i]), "t": float(t.threshold[i]),
                        "l": int(t.children_left[i]), "r": int(t.children_right[i])})
    return nos


def treinar():
    X, y = carregar()
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    arvore = DecisionTreeClassifier(max_depth=6, random_state=42).fit(Xtr, ytr)
    floresta = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=42, n_jobs=-1).fit(Xtr, ytr)

    linhas = []
    def reg(txt=""):
        print(txt)
        linhas.append(txt)

    reg("=== Diagnóstico de dificuldade — treino ===")
    reg(f"Amostras: {len(X)} (treino {len(Xtr)}, teste {len(Xte)})")
    reg(f"Features: {NOMES}")
    reg("")
    for nome, modelo in [("Árvore de Decisão", arvore), ("Random Forest", floresta)]:
        pred = modelo.predict(Xte)
        acc = accuracy_score(yte, pred)
        rotulos = [str(c) for c in modelo.classes_]
        reg(f"--- {nome} ---")
        reg(f"Acurácia (teste): {acc:.3f}")
        reg("Matriz de confusão (linhas=real, colunas=previsto) ordem " + str(rotulos) + ":")
        reg(str(confusion_matrix(yte, pred, labels=rotulos)))
        reg(classification_report(yte, pred, zero_division=0))

    reg("Importância das features (Random Forest):")
    for nome_f, imp in sorted(zip(NOMES, floresta.feature_importances_), key=lambda x: -x[1]):
        reg(f"  {nome_f:12s} {imp:.3f}")

    # Comparação com a regra simples antiga (limiar na média recente), para mostrar o ganho do ML.
    idx_recente = NOMES.index("recente")
    def regra(x):
        r = x[idx_recente]
        return "ok" if r >= 70 else "atencao" if r >= 55 else "alerta"
    acc_regra = accuracy_score(yte, [regra(x) for x in Xte])
    reg("")
    reg(f"Baseline (regra de limiar na média recente): acurácia {acc_regra:.3f}")
    reg(f"Random Forest sobre o baseline: +{accuracy_score(yte, floresta.predict(Xte)) - acc_regra:.3f}")

    # Exporta o Random Forest (o modelo implantado) em JSON para inferência pura.
    modelo_classes = list(floresta.classes_)
    pacote = {
        "tipo": "random_forest",
        "features": NOMES,
        "classes": modelo_classes,
        "arvores": [_exportar_arvore(est) for est in floresta.estimators_],
    }
    with open(MODELO_JSON, "w", encoding="utf-8") as f:
        json.dump(pacote, f)
    reg("")
    reg(f"Modelo exportado para {os.path.relpath(MODELO_JSON)} ({len(pacote['arvores'])} árvores).")

    with open(RELATORIO, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas))


if __name__ == "__main__":
    treinar()
