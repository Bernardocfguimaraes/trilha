"""Dificuldade adaptativa dentro de uma sessão do aluno.

Port direto de src/lib/adaptacao.ts do frontend — a regra tem que ser a mesma nos
dois lados. Começa no médio; 2 acertos seguidos sobe um nível, 2 erros seguidos
desce um. Nos extremos o nível se mantém e a contagem recomeça. A adaptação é
silenciosa: o aluno nunca vê o nível, para não ser rotulado.

Funções puras, sem dependência de framework.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Nivel = Literal["facil", "medio", "dificil"]

NIVEIS: list[Nivel] = ["facil", "medio", "dificil"]
NIVEL_INICIAL: Nivel = "medio"
SEGUIDAS_PARA_MUDAR = 2


@dataclass
class EstadoAdaptacao:
    nivel: Nivel = NIVEL_INICIAL
    acertos_seguidos: int = 0
    erros_seguidos: int = 0


def estado_inicial_adaptacao() -> EstadoAdaptacao:
    return EstadoAdaptacao(nivel=NIVEL_INICIAL, acertos_seguidos=0, erros_seguidos=0)


def _deslocar(nivel: Nivel, passo: int) -> Nivel:
    i = min(len(NIVEIS) - 1, max(0, NIVEIS.index(nivel) + passo))
    return NIVEIS[i]


def registrar_resposta(estado: EstadoAdaptacao, correta: bool) -> EstadoAdaptacao:
    """Novo estado depois de uma resposta."""
    acertos = estado.acertos_seguidos + 1 if correta else 0
    erros = 0 if correta else estado.erros_seguidos + 1

    if acertos >= SEGUIDAS_PARA_MUDAR:
        return EstadoAdaptacao(nivel=_deslocar(estado.nivel, 1), acertos_seguidos=0, erros_seguidos=0)
    if erros >= SEGUIDAS_PARA_MUDAR:
        return EstadoAdaptacao(nivel=_deslocar(estado.nivel, -1), acertos_seguidos=0, erros_seguidos=0)
    return EstadoAdaptacao(nivel=estado.nivel, acertos_seguidos=acertos, erros_seguidos=erros)
