"""Previsão de risco de alerta — inferência em Python puro (o treino fica em ml/risco.py).

Para uma habilidade que HOJE ainda não está em alerta, estima a chance de a média das
próximas sessões cair abaixo de 55. Só vale nesse recorte (é nele que o modelo foi treinado)
e com pelo menos 3 dias de histórico; fora disso devolve None.
"""
from __future__ import annotations

import json
import os

from .diag_features import NOMES, extrair
from .diagnostico import _prob_arvore

_CAMINHO = os.path.join(os.path.dirname(__file__), "modelo_risco.json")
_METRICAS = os.path.join(os.path.dirname(__file__), "modelo_risco_metricas.json")
_MODELO = None
LIMIAR_ALERTA = 55


def _carregar():
    global _MODELO
    if _MODELO is None and os.path.exists(_CAMINHO):
        with open(_CAMINHO, encoding="utf-8") as f:
            _MODELO = json.load(f)
    return _MODELO


def prever(serie: list[dict]) -> dict | None:
    """{"probabilidade": 0–1, "emRisco": bool} ou None quando a previsão não se aplica."""
    modelo = _carregar()
    if not modelo or len(serie) < 3:
        return None
    x = extrair(serie)
    if x[NOMES.index("recente")] < LIMIAR_ALERTA:
        return None  # já está em alerta: não é previsão, é diagnóstico
    i = modelo["classes"].index(1)
    p = sum(_prob_arvore(a, x)[i] for a in modelo["arvores"]) / len(modelo["arvores"])
    return {"probabilidade": round(p, 3), "emRisco": p >= modelo["limiar"]}


def metricas() -> dict | None:
    if not os.path.exists(_METRICAS):
        return None
    with open(_METRICAS, encoding="utf-8") as f:
        return json.load(f)
