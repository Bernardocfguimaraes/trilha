"""Treina e avalia o diagnóstico de dificuldade, e exporta o modelo para o backend.

Pipeline de ML clássico (scikit-learn):
  1. carrega o dataset (ml/dados_sinteticos.csv; gera se faltar)
  2. separa treino/teste (estratificado)
  3. compara modelos: Árvore de Decisão, Random Forest original e Random Forest com classes
     balanceadas e hiperparâmetros escolhidos por validação cruzada (F1 macro)
  4. reporta acurácia, F1 macro, matriz de confusão, relatório por classe e importâncias
  5. exporta o melhor Random Forest para app/modelo_diagnostico.json (inferência em Python
     puro no backend) e as métricas para app/modelo_metricas.json (a tela do professor mostra)
  6. salva o relatório em ml/relatorio_treino.txt

Por que F1 macro, e não acurácia: "atenção" é a classe menor (cerca de 19% dos casos) e a
mais difícil (fica entre ok e alerta). Um modelo pode ter boa acurácia quase ignorando
essa classe — e é justamente o aluno em atenção que mais se beneficia de agir cedo.

Uso: python -m ml.treinar
Requer scikit-learn + numpy (ml/requirements-treino.txt). O BACKEND não precisa deles:
ele lê o JSON e classifica sem scikit-learn.
"""
from __future__ import annotations

import csv
import json
import os
from collections import Counter
from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.tree import DecisionTreeClassifier

from app.diag_features import NOMES

AQUI = os.path.dirname(__file__)
CSV = os.path.join(AQUI, "dados_sinteticos.csv")
RELATORIO = os.path.join(AQUI, "relatorio_treino.txt")
MODELO_JSON = os.path.join(AQUI, os.pardir, "app", "modelo_diagnostico.json")
METRICAS_JSON = os.path.join(AQUI, os.pardir, "app", "modelo_metricas.json")
CLASSES = ["alerta", "atencao", "ok"]  # ordem fixa
SEMENTE = 42

# Nome de cada feature para a interface (o que o professor entende).
NOMES_LEGIVEIS = {
    "media": "Média geral",
    "recente": "Média recente",
    "inicial": "Média inicial",
    "tendencia": "Tendência (subindo ou caindo)",
    "desvio": "Oscilação entre os dias",
    "minimo": "Pior dia",
    "n_dias": "Dias com atividade",
}


def carregar(caminho: str = CSV):
    if caminho == CSV and not os.path.exists(CSV):
        from ml.gerar_dados import gerar
        gerar()
    X, y = [], []
    with open(caminho, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            X.append([float(row[n]) for n in NOMES])
            y.append(row["status"])
    return np.array(X), np.array(y)


def _exportar_arvore(tree) -> list[dict]:
    """Converte uma árvore do sklearn em nós simples {f,t,l,r} ou {p: distribuição}."""
    t = tree.tree_
    nos = []
    for i in range(t.node_count):
        if t.children_left[i] == t.children_right[i]:  # folha
            contagem = t.value[i][0]
            total = float(contagem.sum()) or 1.0
            # Guarda a distribuição de probabilidade (voto suave, igual ao sklearn).
            nos.append({"p": [round(float(c) / total, 6) for c in contagem]})
        else:
            nos.append({"f": int(t.feature[i]), "t": round(float(t.threshold[i]), 6),
                        "l": int(t.children_left[i]), "r": int(t.children_right[i])})
    return nos


def _regra(X) -> list[str]:
    """Baseline: a regra antiga, limiar na média recente."""
    i = NOMES.index("recente")
    return ["ok" if x[i] >= 70 else "atencao" if x[i] >= 55 else "alerta" for x in X]


def _metricas(y_real, y_prev) -> dict:
    p, r, f, s = precision_recall_fscore_support(y_real, y_prev, labels=CLASSES, zero_division=0)
    return {
        "acuracia": round(float(accuracy_score(y_real, y_prev)), 4),
        "f1Macro": round(float(f1_score(y_real, y_prev, labels=CLASSES, average="macro", zero_division=0)), 4),
        "porClasse": {
            c: {"precisao": round(float(p[k]), 4), "recall": round(float(r[k]), 4), "f1": round(float(f[k]), 4), "suporte": int(s[k])}
            for k, c in enumerate(CLASSES)
        },
        "matriz": confusion_matrix(y_real, y_prev, labels=CLASSES).tolist(),
    }


def treinar(caminho_dados: str = CSV, origem: str = "sintéticos") -> dict:
    X, y = carregar(caminho_dados)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=SEMENTE, stratify=y)

    arvore = DecisionTreeClassifier(max_depth=6, random_state=SEMENTE).fit(Xtr, ytr)
    rf_original = RandomForestClassifier(n_estimators=200, max_depth=10, random_state=SEMENTE, n_jobs=-1).fit(Xtr, ytr)

    # Busca em grade com validação cruzada estratificada, otimizando F1 macro.
    busca = GridSearchCV(
        RandomForestClassifier(n_estimators=200, random_state=SEMENTE, n_jobs=-1),
        {
            "max_depth": [6, 8, 10],
            "min_samples_leaf": [1, 5, 10],
            "class_weight": [None, "balanced", "balanced_subsample"],
        },
        scoring="f1_macro",
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=SEMENTE),
        n_jobs=-1,
    ).fit(Xtr, ytr)
    rf_final = busca.best_estimator_

    linhas: list[str] = []

    def reg(txt=""):
        print(txt)
        linhas.append(txt)

    reg("=== Diagnóstico de dificuldade — treino ===")
    reg(f"Dados: {origem} — {len(X)} amostras (treino {len(Xtr)}, teste {len(Xte)})")
    reg(f"Distribuição: {dict(Counter(y.tolist()))}")
    reg(f"Features: {NOMES}")
    reg("")
    resultados = {}
    for nome, modelo in [("Árvore de Decisão", arvore), ("Random Forest original", rf_original), ("Random Forest ajustado", rf_final)]:
        pred = modelo.predict(Xte)
        resultados[nome] = _metricas(yte, pred)
        reg(f"--- {nome} ---")
        reg(f"Acurácia (teste): {resultados[nome]['acuracia']:.3f}   F1 macro: {resultados[nome]['f1Macro']:.3f}")
        reg(f"Matriz de confusão (linhas=real, colunas=previsto) ordem {CLASSES}:")
        reg(str(confusion_matrix(yte, pred, labels=CLASSES)))
        reg(classification_report(yte, pred, labels=CLASSES, zero_division=0))

    reg(f"Hiperparâmetros escolhidos (validação cruzada 5 dobras, F1 macro {busca.best_score_:.3f}): {busca.best_params_}")
    antes, depois = resultados["Random Forest original"], resultados["Random Forest ajustado"]
    reg(f"Recall de 'atenção': {antes['porClasse']['atencao']['recall']:.2f} → {depois['porClasse']['atencao']['recall']:.2f}")
    reg("")
    reg("Importância das features (Random Forest ajustado):")
    importancias = sorted(zip(NOMES, rf_final.feature_importances_), key=lambda x: -x[1])
    for nome_f, imp in importancias:
        reg(f"  {nome_f:12s} {imp:.3f}")

    baseline = _metricas(yte, _regra(Xte))
    reg("")
    reg(f"Baseline (regra de limiar na média recente): acurácia {baseline['acuracia']:.3f}, F1 macro {baseline['f1Macro']:.3f}")
    reg(f"Random Forest ajustado sobre o baseline: acurácia +{depois['acuracia'] - baseline['acuracia']:.3f}, F1 macro +{depois['f1Macro'] - baseline['f1Macro']:.3f}")

    # Exporta o modelo implantado (JSON, inferência em Python puro no backend).
    pacote = {
        "tipo": "random_forest",
        "features": NOMES,
        "classes": [str(c) for c in rf_final.classes_],
        "arvores": [_exportar_arvore(est) for est in rf_final.estimators_],
    }
    with open(MODELO_JSON, "w", encoding="utf-8") as f:
        json.dump(pacote, f, separators=(",", ":"))

    metricas = {
        "treinadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dados": {"origem": origem, "amostras": len(X), "treino": len(Xtr), "teste": len(Xte),
                  "distribuicao": dict(Counter(y.tolist()))},
        "modelo": {"nome": "Random Forest", "arvores": len(rf_final.estimators_),
                   "parametros": {k: v for k, v in busca.best_params_.items()},
                   "validacaoCruzadaF1Macro": round(float(busca.best_score_), 4)},
        "classes": CLASSES,
        "implantado": depois,
        "antesDoAjuste": antes,
        "arvoreDeDecisao": resultados["Árvore de Decisão"],
        "baseline": {"descricao": "Limiar na média recente (≥70 ok, ≥55 atenção)", **baseline},
        "importancias": [{"feature": n, "nome": NOMES_LEGIVEIS[n], "valor": round(float(v), 4)} for n, v in importancias],
    }
    with open(METRICAS_JSON, "w", encoding="utf-8") as f:
        json.dump(metricas, f, ensure_ascii=False, indent=1)

    reg("")
    reg(f"Modelo exportado para {os.path.relpath(MODELO_JSON)} ({len(pacote['arvores'])} árvores); métricas em {os.path.relpath(METRICAS_JSON)}.")
    with open(RELATORIO, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    return metricas


if __name__ == "__main__":
    treinar()
