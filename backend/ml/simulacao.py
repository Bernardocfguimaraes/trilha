from __future__ import annotations

import random

from app.adaptacao import estado_inicial_adaptacao, registrar_resposta
from app.regras import PERGUNTAS_POR_SESSAO, PONTOS_RESPOSTA

AJUSTE_NIVEL = {"facil": 0.15, "medio": 0.0, "dificil": -0.15}
CHANCE_DUAS_SESSOES_NO_DIA = 0.15
HABILIDADES_POR_SESSAO = ([1, 2, 3, 4], [0.10, 0.15, 0.40, 0.35])


def _clip(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def chance_de_acerto(nivel_latente: float, nivel_pergunta: str) -> float:
    base = (nivel_latente - 20) / 60
    return max(0.0, min(1.0, base + AJUSTE_NIVEL[nivel_pergunta]))


def _sessao(rng: random.Random, nivel_latente: float) -> list[int]:
    n_habilidades = rng.choices(*HABILIDADES_POR_SESSAO)[0]
    minha_vez = rng.randrange(n_habilidades)
    adaptacao = estado_inicial_adaptacao()
    pontos = []
    for i in range(PERGUNTAS_POR_SESSAO):
        nivel = adaptacao.nivel
        acertou = rng.random() < chance_de_acerto(nivel_latente, nivel)
        adaptacao = registrar_resposta(adaptacao, acertou)
        if i % n_habilidades == minha_vez:
            certa, errada = PONTOS_RESPOSTA[nivel]["certa"], PONTOS_RESPOSTA[nivel]["errada"]
            pontos.append(certa if acertou else errada)
    return pontos


def desempenho_do_dia(rng: random.Random, nivel_latente: float) -> int:
    pontos = _sessao(rng, nivel_latente)
    if rng.random() < CHANCE_DUAS_SESSOES_NO_DIA:
        pontos += _sessao(rng, nivel_latente)
    return round(sum(pontos) / len(pontos))


def trajetoria(rng: random.Random, proficiencia: float, tendencia: float, n_dias: int) -> tuple[list[float], list[dict]]:
    niveis = [_clip(proficiencia + tendencia * (i / max(n_dias - 1, 1))) for i in range(n_dias)]
    serie = [{"data": f"d{i:02d}", "desempenho": desempenho_do_dia(rng, n)} for i, n in enumerate(niveis)]
    return niveis, serie
