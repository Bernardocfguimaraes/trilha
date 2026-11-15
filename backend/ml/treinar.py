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
REAIS = os.path.join(AQUI, "dados_reais.csv")
CLASSES = ["alerta", "atencao", "ok"]
SEMENTE = 42
MIN_REAIS = 20
PESO_REAL = 5.0

NOMES_LEGIVEIS = {
    "media": "Média geral",
    "recente": "Média recente",
    "inicial": "Média inicial",
    "tendencia": "Tendência (subindo ou caindo)",
    "desvio": "Oscilação entre os dias",
    "minimo": "Pior dia",
    "n_dias": "Dias com atividade",
    "projecao": "Nível estimado hoje",
    "variacao": "Variação no período",
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
    t = tree.tree_
    nos = []
    for i in range(t.node_count):
        if t.children_left[i] == t.children_right[i]:
            contagem = t.value[i][0]
            total = float(contagem.sum()) or 1.0
            nos.append({"p": [round(float(c) / total, 6) for c in contagem]})
        else:
            nos.append({"f": int(t.feature[i]), "t": round(float(t.threshold[i]), 6),
                        "l": int(t.children_left[i]), "r": int(t.children_right[i])})
    return nos


def _regra(X) -> list[str]:
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

    busca = GridSearchCV(
        RandomForestClassifier(n_estimators=200, random_state=SEMENTE, n_jobs=-1),
        {
            "max_depth": [4, 6, 8, 10],
            "min_samples_leaf": [5, 10, 20],
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

    reais = None
    if os.path.exists(REAIS):
        rf_final, reais = _com_dados_reais(Xtr, ytr, rf_final, busca.best_params_, reg)
        if reais.get("incluidosNoModelo"):
            origem = f"{origem} + {reais['amostras']} reais"

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
        "reais": reais,
    }
    with open(METRICAS_JSON, "w", encoding="utf-8") as f:
        json.dump(metricas, f, ensure_ascii=False, indent=1)

    reg("")
    reg(f"Modelo exportado para {os.path.relpath(MODELO_JSON)} ({len(pacote['arvores'])} árvores); métricas em {os.path.relpath(METRICAS_JSON)}.")
    with open(RELATORIO, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    return metricas


def _com_dados_reais(Xtr, ytr, rf_sintetico, params, reg):
    Xr, yr = carregar(REAIS)
    info = {"amostras": int(len(Xr)), "distribuicao": dict(Counter(yr.tolist())), "incluidosNoModelo": False}
    reg("")
    reg(f"=== Dados reais (avaliação de professores): {len(Xr)} amostras {info['distribuicao']} ===")
    if len(Xr) == 0:
        return rf_sintetico, info
    info["concordanciaModeloSintetico"] = round(float(accuracy_score(yr, rf_sintetico.predict(Xr))), 4)
    reg(f"Concordância do modelo treinado só com sintéticos: {info['concordanciaModeloSintetico']:.3f}")

    menor = min(Counter(yr.tolist()).values())
    if len(Xr) < MIN_REAIS or len(set(yr.tolist())) < 2 or menor < 2:
        info["observacao"] = f"Poucas avaliações para retreinar (mínimo {MIN_REAIS}, com pelo menos 2 de cada status presente)."
        reg(info["observacao"])
        return rf_sintetico, info

    so_sint, com_reais, reais_verdade = [], [], []
    for itr, ite in StratifiedKFold(n_splits=min(5, menor), shuffle=True, random_state=SEMENTE).split(Xr, yr):
        a = RandomForestClassifier(n_estimators=200, random_state=SEMENTE, n_jobs=-1, **params).fit(Xtr, ytr)
        X_mix = np.vstack([Xtr, Xr[itr]])
        y_mix = np.concatenate([ytr, yr[itr]])
        peso = np.concatenate([np.ones(len(Xtr)), np.full(len(itr), PESO_REAL)])
        b = RandomForestClassifier(n_estimators=200, random_state=SEMENTE, n_jobs=-1, **params).fit(X_mix, y_mix, sample_weight=peso)
        so_sint.extend(a.predict(Xr[ite]))
        com_reais.extend(b.predict(Xr[ite]))
        reais_verdade.extend(yr[ite])
    info["validacaoSoSinteticos"] = _metricas(reais_verdade, so_sint)
    info["validacaoComReais"] = _metricas(reais_verdade, com_reais)
    reg(f"Validação cruzada nos reais — só sintéticos: acurácia {info['validacaoSoSinteticos']['acuracia']:.3f}, F1 macro {info['validacaoSoSinteticos']['f1Macro']:.3f}")
    reg(f"Validação cruzada nos reais — sintéticos + reais: acurácia {info['validacaoComReais']['acuracia']:.3f}, F1 macro {info['validacaoComReais']['f1Macro']:.3f}")

    if info["validacaoComReais"]["f1Macro"] < info["validacaoSoSinteticos"]["f1Macro"]:
        info["observacao"] = "Os casos reais não melhoraram a validação; o modelo em uso continua o treinado com dados simulados."
        reg(info["observacao"])
        return rf_sintetico, info
    final = RandomForestClassifier(n_estimators=200, random_state=SEMENTE, n_jobs=-1, **params).fit(
        np.vstack([Xtr, Xr]), np.concatenate([ytr, yr]),
        sample_weight=np.concatenate([np.ones(len(Xtr)), np.full(len(Xr), PESO_REAL)]),
    )
    info["incluidosNoModelo"] = True
    reg(f"Modelo implantado retreinado com os {len(Xr)} casos reais (peso {PESO_REAL:g}).")
    return final, info


if __name__ == "__main__":
    treinar()
