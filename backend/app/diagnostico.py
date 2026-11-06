"""Diagnóstico de dificuldade por ML — inferência em Python puro.

Carrega o modelo treinado (app/modelo_diagnostico.json, um Random Forest exportado) e
classifica a série de desempenho de uma habilidade em "ok" | "atencao" | "alerta",
sem depender de scikit-learn/numpy. O treino fica em ml/treinar.py.

Se o JSON não existir (modelo não treinado ainda), cai numa regra de limiar simples —
o backend continua funcionando, só sem o ML. Assim nada quebra se o modelo faltar.
"""
from __future__ import annotations

import json
import os
from .diag_features import NOMES, extrair

_MODELO = None
_CAMINHO = os.path.join(os.path.dirname(__file__), "modelo_diagnostico.json")


def _carregar():
    global _MODELO
    if _MODELO is None and os.path.exists(_CAMINHO):
        with open(_CAMINHO, encoding="utf-8") as f:
            _MODELO = json.load(f)
    return _MODELO


def tem_modelo() -> bool:
    return _carregar() is not None


def _prob_arvore(nos: list[dict], x: list[float]) -> list[float]:
    """Desce a árvore e devolve a distribuição de probabilidade da folha."""
    i = 0
    while True:
        no = nos[i]
        if "p" in no:
            return no["p"]
        i = no["l"] if x[no["f"]] <= no["t"] else no["r"]


def _regra_simples(serie: list[dict]) -> str:
    """Fallback sem ML: limiar na média dos 3 últimos registros (a regra do passo 2)."""
    if not serie:
        return "ok"
    ultimos = [p["desempenho"] for p in serie[-3:]]
    media = sum(ultimos) / len(ultimos)
    return "ok" if media >= 70 else "atencao" if media >= 55 else "alerta"


def probabilidades(serie: list[dict]) -> dict[str, float] | None:
    """Probabilidade de cada status segundo o Random Forest (voto suave das árvores).
    None se o modelo não estiver disponível."""
    modelo = _carregar()
    if not modelo:
        return None
    x = extrair(serie)
    classes = modelo["classes"]
    soma = [0.0] * len(classes)
    for arvore in modelo["arvores"]:
        for j, pj in enumerate(_prob_arvore(arvore, x)):
            soma[j] += pj
    n = len(modelo["arvores"])
    return {c: soma[j] / n for j, c in enumerate(classes)}


def classificar(serie: list[dict]) -> str:
    """Status de uma habilidade a partir da sua série de desempenho."""
    probs = probabilidades(serie)
    if probs is None:
        return _regra_simples(serie)
    return max(probs, key=probs.get)


def _motivos(f: dict[str, float]) -> list[str]:
    """Frases curtas, em linguagem do professor, sobre os indicadores que o modelo usa.
    Descrevem os dados (não inventam causa): o professor confere no gráfico ao lado."""
    m = []
    r = round(f["recente"])
    m.append(f"Média dos últimos dias: {r} de 100" + (" (baixa)" if r < 55 else " (no limite)" if r < 70 else " (boa)") + ".")
    t = round(f["tendencia"])
    if f["n_dias"] >= 4 and abs(t) >= 5:
        m.append(f"Vem {'melhorando' if t > 0 else 'piorando'}: {abs(t)} pontos {'acima' if t > 0 else 'abaixo'} do começo.")
    elif f["n_dias"] >= 4:
        m.append("Está estável: quase não mudou desde o começo.")
    if f["desvio"] >= 15:
        m.append("Oscila bastante de um dia para o outro.")
    if f["minimo"] < 40:
        m.append(f"Teve um dia bem difícil (pior resultado: {round(f['minimo'])}).")
    if f["n_dias"] < 3:
        m.append(f"Ainda há poucos dados ({int(f['n_dias'])} {'dia' if f['n_dias'] == 1 else 'dias'} de atividade): o diagnóstico pode mudar rápido.")
    return m


def explicar(serie: list[dict]) -> dict:
    """Decisão do modelo + confiança + os indicadores que ele usou, para a tela do professor."""
    f = dict(zip(NOMES, extrair(serie)))
    probs = probabilidades(serie)
    if probs is None:
        status = _regra_simples(serie)
        return {"status": status, "modelo": "regra", "confianca": None, "probabilidades": None,
                "indicadores": f, "motivos": _motivos(f)}
    status = max(probs, key=probs.get)
    return {
        "status": status,
        "modelo": "ml",
        "confianca": round(probs[status], 3),
        "probabilidades": {c: round(v, 3) for c, v in probs.items()},
        "indicadores": f,
        "motivos": _motivos(f),
    }


_METRICAS = os.path.join(os.path.dirname(__file__), "modelo_metricas.json")


def metricas() -> dict | None:
    """Métricas do último treino (ml/treinar.py), para a página "Como o diagnóstico funciona"."""
    if not os.path.exists(_METRICAS):
        return None
    with open(_METRICAS, encoding="utf-8") as f:
        return json.load(f)
