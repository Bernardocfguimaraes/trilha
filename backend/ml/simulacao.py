"""Simulador do desempenho diário, com o MESMO processo que o app usa para gerar os dados.

Por que existe: a primeira versão dos dados de treino somava ao nível do aluno um ruído
pequeno (desvio de 6 pontos). No app, porém, a nota do dia numa habilidade é a média de
poucas respostas (1 ou 2 por sessão), cada uma valendo pontos fixos por nível (60/0 no
fácil, 80/20 no médio, 100/40 no difícil — app/regras.PONTOS_RESPOSTA). A nota pula em
degraus de 20 pontos. Treinado com notas suaves, o modelo ficava pior que a regra simples
quando via dados do jeito que o app gera. Daqui em diante, treino e produção têm a mesma
origem de dados.

Como um dia é simulado:
- Cada aluno-habilidade tem um nível latente (0 a 100) naquele dia. Ele é a nota esperada
  numa pergunta de nível médio: P(acerto no médio) = (nível − 20) / 60. Fácil tem chance
  maior e difícil, menor.
- A sessão tem PERGUNTAS_POR_SESSAO perguntas, revezando entre as habilidades da "frente"
  do caminho (em geral 3 ou 4; 1 ou 2 quando a professora deixa poucas habilidades ativas
  ou no fim do caminho); a dificuldade se adapta ao longo da sessão como no app
  (app/adaptacao.py). Cada habilidade fica com 1 ou 2 respostas, ou com 3 a 6 quando a
  sessão tem poucas habilidades, e aí a nota do dia oscila menos.
- Às vezes o aluno faz mais de uma sessão no mesmo dia; o app guarda a média do dia.

Só usa a biblioteca padrão e as regras do próprio app (pontos, tamanho da sessão,
adaptação), para que uma mudança nelas valha também para o treino.
"""
from __future__ import annotations

import random

from app.adaptacao import estado_inicial_adaptacao, registrar_resposta
from app.regras import PERGUNTAS_POR_SESSAO, PONTOS_RESPOSTA

# Quanto a chance de acerto muda entre os níveis, em relação ao médio.
AJUSTE_NIVEL = {"facil": 0.15, "medio": 0.0, "dificil": -0.15}
CHANCE_DUAS_SESSOES_NO_DIA = 0.15
# Quantas habilidades dividem as perguntas de uma sessão, e com que frequência.
HABILIDADES_POR_SESSAO = ([1, 2, 3, 4], [0.10, 0.15, 0.40, 0.35])


def _clip(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


def chance_de_acerto(nivel_latente: float, nivel_pergunta: str) -> float:
    base = (nivel_latente - 20) / 60
    return max(0.0, min(1.0, base + AJUSTE_NIVEL[nivel_pergunta]))


def _sessao(rng: random.Random, nivel_latente: float) -> list[int]:
    """Pontos que a habilidade recebe numa sessão: as posições dela no revezamento."""
    n_habilidades = rng.choices(*HABILIDADES_POR_SESSAO)[0]
    minha_vez = rng.randrange(n_habilidades)
    adaptacao = estado_inicial_adaptacao()
    pontos = []
    for i in range(PERGUNTAS_POR_SESSAO):
        nivel = adaptacao.nivel
        acertou = rng.random() < chance_de_acerto(nivel_latente, nivel)
        # As outras habilidades da sessão também mexem na dificuldade; para simplificar,
        # o aluno tem desempenho parecido nelas.
        adaptacao = registrar_resposta(adaptacao, acertou)
        if i % n_habilidades == minha_vez:
            certa, errada = PONTOS_RESPOSTA[nivel]["certa"], PONTOS_RESPOSTA[nivel]["errada"]
            pontos.append(certa if acertou else errada)
    return pontos


def desempenho_do_dia(rng: random.Random, nivel_latente: float) -> int:
    """Nota do dia (0–100) numa habilidade, como o app grava no histórico."""
    pontos = _sessao(rng, nivel_latente)
    if rng.random() < CHANCE_DUAS_SESSOES_NO_DIA:
        pontos += _sessao(rng, nivel_latente)
    return round(sum(pontos) / len(pontos))


def trajetoria(rng: random.Random, proficiencia: float, tendencia: float, n_dias: int) -> tuple[list[float], list[dict]]:
    """Níveis latentes de cada dia (mudança linear ao longo do período) e a série observada."""
    niveis = [_clip(proficiencia + tendencia * (i / max(n_dias - 1, 1))) for i in range(n_dias)]
    serie = [{"data": f"d{i:02d}", "desempenho": desempenho_do_dia(rng, n)} for i, n in enumerate(niveis)]
    return niveis, serie
