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
    i = 0
    while True:
        no = nos[i]
        if "p" in no:
            return no["p"]
        i = no["l"] if x[no["f"]] <= no["t"] else no["r"]


def _regra_simples(serie: list[dict]) -> str:
    if not serie:
        return "ok"
    ultimos = [p["desempenho"] for p in serie[-3:]]
    media = sum(ultimos) / len(ultimos)
    return "ok" if media >= 70 else "atencao" if media >= 55 else "alerta"


def probabilidades(serie: list[dict]) -> dict[str, float] | None:
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
    probs = probabilidades(serie)
    if probs is None:
        return _regra_simples(serie)
    return max(probs, key=probs.get)


def _faixa(valor: float) -> str:
    return " (baixo)" if valor < 55 else " (no limite)" if valor < 70 else " (bom)"


def _motivos(f: dict[str, float]) -> list[str]:
    m = []
    if f["n_dias"] >= 3:
        p = round(f["projecao"])
        m.append(f"Nível estimado hoje, considerando todos os dias: {p} de 100{_faixa(p)}.")
    r = round(f["recente"])
    m.append(f"Média dos últimos dias: {r} de 100" + (" (baixa)" if r < 55 else " (no limite)" if r < 70 else " (boa)") + ".")
    t = round(f["variacao"])
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
    if not os.path.exists(_METRICAS):
        return None
    with open(_METRICAS, encoding="utf-8") as f:
        return json.load(f)
