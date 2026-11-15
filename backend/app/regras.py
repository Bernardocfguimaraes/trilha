from __future__ import annotations

import math
import random
from datetime import datetime, timedelta, timezone

from .adaptacao import NIVEIS
from .dados import BANCO, HAB_POR_ID


class ApiErro(Exception):
    def __init__(self, status: int, mensagem: str):
        super().__init__(mensagem)
        self.status = status
        self.mensagem = mensagem


PERGUNTAS_POR_SESSAO = 6
MAX_ERROS_PIN = 5
ESPERA_BLOQUEIO_MS = 60_000
ELOGIOS = ["Isso aí!", "Mandou bem!", "Acertou!", "Muito bem!"]
PONTOS_RESPOSTA = {
    "facil": {"certa": 60, "errada": 0},
    "medio": {"certa": 80, "errada": 20},
    "dificil": {"certa": 100, "errada": 40},
}


def arred(x: float) -> int:
    return math.floor(x + 0.5)


FUSO = timezone(timedelta(hours=-3), "America/Sao_Paulo")


def hoje(agora: datetime | None = None) -> str:
    return (agora or datetime.now(timezone.utc)).astimezone(FUSO).date().isoformat()


def agora_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def curto(nome: str) -> str:
    partes = nome.split()
    return f"{partes[0]} {partes[-1][0]}." if len(partes) > 1 else partes[0]


def habilidade_config(h: dict, ativas: set[str]) -> dict:
    return {
        "id": h["id"], "nome": h["nome"], "descricao": h["descricao"],
        "ativa": h["avaliavel"] and h["id"] in ativas,
        "codigoBncc": h["codigoBncc"], "unidade": h["unidade"], "avaliavel": h["avaliavel"],
    }


def escolher_pergunta(habilidades: list[str], nivel: str, usadas: set[str], vez: int) -> dict | None:
    if not habilidades:
        return None
    alvo = habilidades[vez % len(habilidades)]

    def custo(p: dict) -> float:
        return abs(NIVEIS.index(p["nivel"]) - NIVEIS.index(nivel)) * 10 + (0 if p["habilidadeId"] == alvo else 1) + random.random() * 0.5

    candidatas = [p for p in BANCO if p["habilidadeId"] in habilidades and p["id"] not in usadas]
    if not candidatas:
        return None
    return min(candidatas, key=custo)


def para_cliente(p: dict) -> dict:
    return {
        "id": p["id"],
        "disciplina": HAB_POR_ID[p["habilidadeId"]]["disciplina"],
        "habilidadeId": p["habilidadeId"],
        "nivel": p["nivel"],
        "enunciado": p["enunciado"],
        "apoio": p.get("apoio"),
        "opcoes": [{"id": f"{p['id']}-{i}", "texto": texto} for i, texto in enumerate(p["opcoes"])],
    }


def novo_pin(anterior: str | None = None) -> str:
    while True:
        pin = str(random.randint(0, 9999)).zfill(4)
        if pin != anterior and len(set(pin)) != 1:
            return pin
