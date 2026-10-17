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
from .diag_features import extrair

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


def classificar(serie: list[dict]) -> str:
    """Status de uma habilidade a partir da sua série de desempenho."""
    modelo = _carregar()
    if not modelo:
        return _regra_simples(serie)
    x = extrair(serie)
    classes = modelo["classes"]
    # Voto suave: soma as probabilidades das folhas de todas as árvores e pega a maior.
    soma = [0.0] * len(classes)
    for arvore in modelo["arvores"]:
        for j, pj in enumerate(_prob_arvore(arvore, x)):
            soma[j] += pj
    return classes[max(range(len(classes)), key=lambda j: soma[j])]
