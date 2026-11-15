from __future__ import annotations

import json
import os
import random
from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_predict, train_test_split

from app.diag_features import NOMES, extrair
from ml.simulacao import trajetoria
from ml.treinar import NOMES_LEGIVEIS, _exportar_arvore

AQUI = os.path.dirname(__file__)
MODELO_JSON = os.path.join(AQUI, os.pardir, "app", "modelo_risco.json")
METRICAS_JSON = os.path.join(AQUI, os.pardir, "app", "modelo_risco_metricas.json")
RELATORIO = os.path.join(AQUI, "relatorio_risco.txt")
SEMENTE = 7
N_AMOSTRAS = 5000
FUTURO = 3
LIMIAR_ALERTA = 55
PRECISAO_MINIMA = 0.59


def gerar_uma(rng: random.Random):
    proficiencia = rng.uniform(30, 95)
    tendencia = rng.uniform(-30, 20)
    n_passado = rng.randint(3, 10)
    niveis, serie = trajetoria(rng, proficiencia, tendencia, n_passado + FUTURO)
    futuro = niveis[n_passado:]
    return extrair(serie[:n_passado]), int(sum(futuro) / FUTURO < LIMIAR_ALERTA)


def _baseline(X) -> np.ndarray:
    it, ir = NOMES.index("tendencia"), NOMES.index("recente")
    return np.array([int(x[it] < 0 and x[ir] < 70) for x in X])


def treinar() -> dict:
    rng = random.Random(SEMENTE)
    ir = NOMES.index("recente")
    pares = []
    while len(pares) < N_AMOSTRAS:
        x, rotulo = gerar_uma(rng)
        if x[ir] >= LIMIAR_ALERTA:
            pares.append((x, rotulo))
    X = np.array([p[0] for p in pares])
    y = np.array([p[1] for p in pares])
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=SEMENTE, stratify=y)

    busca = GridSearchCV(
        RandomForestClassifier(n_estimators=150, random_state=SEMENTE, n_jobs=-1, class_weight="balanced"),
        {"max_depth": [5, 7, 9], "min_samples_leaf": [5, 10, 20]},
        scoring="roc_auc",
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=SEMENTE),
        n_jobs=-1,
    ).fit(Xtr, ytr)
    rf = busca.best_estimator_
    prob_cv = cross_val_predict(
        RandomForestClassifier(n_estimators=150, random_state=SEMENTE, n_jobs=-1, class_weight="balanced", **busca.best_params_),
        Xtr, ytr, cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=SEMENTE), method="predict_proba", n_jobs=-1,
    )[:, 1]
    cortes = [t for t in np.arange(0.2, 0.96, 0.02)
              if (prob_cv >= t).any() and precision_score(ytr, (prob_cv >= t).astype(int)) >= PRECISAO_MINIMA]
    limiar = cortes[0] if cortes else max(np.arange(0.2, 0.96, 0.02), key=lambda t: f1_score(ytr, (prob_cv >= t).astype(int)))
    limiar = round(float(limiar), 2)
    prob = rf.predict_proba(Xte)[:, list(rf.classes_).index(1)]
    prev = (prob >= limiar).astype(int)
    base = _baseline(Xte)

    def bloco(y_real, y_prev, p=None):
        d = {
            "acuracia": round(float(accuracy_score(y_real, y_prev)), 4),
            "precisao": round(float(precision_score(y_real, y_prev, zero_division=0)), 4),
            "recall": round(float(recall_score(y_real, y_prev, zero_division=0)), 4),
            "matriz": confusion_matrix(y_real, y_prev, labels=[0, 1]).tolist(),
        }
        if p is not None:
            d["aucRoc"] = round(float(roc_auc_score(y_real, p)), 4)
        return d

    metricas = {
        "treinadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pergunta": f"O nível do aluno nas próximas {FUTURO} sessões vai ficar abaixo de {LIMIAR_ALERTA}?",
        "dados": {"origem": "sintéticos", "amostras": int(len(X)), "treino": int(len(Xtr)), "teste": int(len(Xte)),
                  "taxaDeQueda": round(float(y.mean()), 4)},
        "recorte": f"Só habilidades com média recente ≥ {LIMIAR_ALERTA} (hoje fora do alerta)",
        "modelo": {"nome": "Random Forest", "arvores": len(rf.estimators_), "parametros": busca.best_params_,
                   "validacaoCruzadaAuc": round(float(busca.best_score_), 4), "limiar": limiar},
        "implantado": bloco(yte, prev, prob),
        "baseline": {"descricao": "Tendência negativa e média recente abaixo de 70", **bloco(yte, base)},
        "importancias": [{"feature": n, "nome": NOMES_LEGIVEIS[n], "valor": round(float(v), 4)}
                         for n, v in sorted(zip(NOMES, rf.feature_importances_), key=lambda t: -t[1])],
    }

    with open(MODELO_JSON, "w", encoding="utf-8") as f:
        json.dump({"tipo": "random_forest", "features": NOMES, "classes": [int(c) for c in rf.classes_], "limiar": limiar,
                   "arvores": [_exportar_arvore(e) for e in rf.estimators_]}, f, separators=(",", ":"))
    with open(METRICAS_JSON, "w", encoding="utf-8") as f:
        json.dump(metricas, f, ensure_ascii=False, indent=1)

    linhas = [
        "=== Previsão de risco de alerta — treino ===",
        metricas["pergunta"],
        metricas["recorte"],
        f"Amostras: {len(X)} (taxa de queda {y.mean():.1%}); parâmetros {busca.best_params_}, AUC validação {busca.best_score_:.3f}, limiar {limiar}",
        f"Teste — AUC {metricas['implantado']['aucRoc']:.3f}, precisão {metricas['implantado']['precisao']:.3f}, recall {metricas['implantado']['recall']:.3f}",
        f"Baseline ({metricas['baseline']['descricao']}) — precisão {metricas['baseline']['precisao']:.3f}, recall {metricas['baseline']['recall']:.3f}",
        "Importâncias: " + ", ".join(f"{i['feature']} {i['valor']:.3f}" for i in metricas["importancias"]),
    ]
    print("\n".join(linhas))
    with open(RELATORIO, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    return metricas


if __name__ == "__main__":
    treinar()
