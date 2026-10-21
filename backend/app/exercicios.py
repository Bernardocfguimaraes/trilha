"""Geração de exercícios por habilidade (passo 5).

O professor pede um exercício de reforço para uma habilidade num dado nível; o LLM gera
uma questão de múltipla escolha no MESMO formato do banco curado (enunciado + 4 opções +
índice da resposta certa), mais uma explicação curta para o professor.

Conteúdo vai para criança, então validamos tudo: tem que vir JSON válido, com exatamente
4 opções distintas e um índice de resposta dentro do intervalo. Se a IA falhar, devolver
algo inválido, ou não estiver configurada, caímos numa questão do banco curado (dados.py) —
a demo nunca fica sem exercício.
"""
from __future__ import annotations

import json
import random

from . import llm
from .dados import BANCO, HABILIDADES

NIVEIS = ("facil", "medio", "dificil")

_SISTEMA = (
    "Você cria exercícios para crianças do ensino fundamental (anos iniciais, 8 a 10 anos). "
    "Gere UMA questão de múltipla escolha em português do Brasil, adequada à idade, clara e sem pegadinha. "
    "Responda SOMENTE com um JSON válido, sem markdown, sem comentários, exatamente neste formato:\n"
    '{"enunciado": "...", "opcoes": ["...", "...", "...", "..."], "indiceCorreta": 0, '
    '"explicacao": "por que a resposta certa está certa, em uma frase para o professor"}\n'
    "Regras: exatamente 4 opções, todas diferentes entre si; APENAS UMA pode estar correta; "
    "as outras três têm que estar de fato erradas. Nunca inclua duas opções que valham a mesma "
    "coisa ou sejam equivalentes (por exemplo, 2/4 e 1/2 são o mesmo valor, então não podem "
    "aparecer juntas; 0,5 e 1/2 também). Antes de responder, confira que só existe UMA resposta "
    "correta entre as quatro. indiceCorreta é a posição (0 a 3) da opção certa; não numere nem "
    "rotule as opções (nada de 'a)', '1.')."
)

_NIVEL_DESC = {
    "facil": "nível fácil (bem introdutório)",
    "medio": "nível médio",
    "dificil": "nível difícil (desafio, ainda dentro dos anos iniciais)",
}


def _habilidade(habilidade_id: str) -> dict | None:
    return next((h for h in HABILIDADES if h["id"] == habilidade_id), None)


def _extrair_json(texto: str) -> dict | None:
    """Pega o primeiro objeto JSON do texto, tolerando cercas ```json e texto em volta."""
    if not texto:
        return None
    inicio = texto.find("{")
    fim = texto.rfind("}")
    if inicio == -1 or fim == -1 or fim < inicio:
        return None
    try:
        return json.loads(texto[inicio : fim + 1])
    except (json.JSONDecodeError, ValueError):
        return None


def _valido(dados: dict) -> bool:
    """Checa o formato antes de deixar passar para a criança."""
    if not isinstance(dados, dict):
        return False
    enunciado = dados.get("enunciado")
    opcoes = dados.get("opcoes")
    indice = dados.get("indiceCorreta")
    if not isinstance(enunciado, str) or not enunciado.strip():
        return False
    if not isinstance(opcoes, list) or len(opcoes) != 4:
        return False
    if any(not isinstance(o, str) or not o.strip() for o in opcoes):
        return False
    if len({o.strip().lower() for o in opcoes}) != 4:  # todas distintas
        return False
    if not isinstance(indice, int) or isinstance(indice, bool) or not 0 <= indice <= 3:
        return False
    return True


def _do_banco(habilidade_id: str, nivel: str) -> dict | None:
    """Fallback: uma questão do banco curado para a habilidade (preferindo o nível pedido)."""
    candidatas = [p for p in BANCO if p["habilidadeId"] == habilidade_id]
    if not candidatas:
        return None
    no_nivel = [p for p in candidatas if p["nivel"] == nivel]
    p = random.choice(no_nivel or candidatas)
    return {
        "enunciado": p["enunciado"],
        "opcoes": list(p["opcoes"]),
        "indiceCorreta": p["certa"],
        "explicacao": "",
        "apoio": p.get("apoio"),
    }


def gerar_exercicio(habilidade_id: str, nivel: str = "medio") -> dict:
    """Gera (ou recupera do banco) um exercício para a habilidade/nível.

    Devolve sempre um dict completo com `origem` = "ia" | "banco" para o front saber
    se é gerado ou curado.
    """
    hab = _habilidade(habilidade_id)
    if hab is None:
        raise ValueError(f"Habilidade desconhecida: {habilidade_id}")
    if nivel not in NIVEIS:
        nivel = "medio"

    gerado = None
    if llm.disponivel():
        prompt = (
            f"Habilidade: {hab['nome']} ({hab['disciplina']}). "
            f"Descrição: {hab['descricao']} "
            f"Gere uma questão de {_NIVEL_DESC[nivel]} sobre essa habilidade."
        )
        bruto = llm.gerar(_SISTEMA, [{"role": "user", "content": prompt}], max_tokens=800)
        dados = _extrair_json(bruto or "")
        if dados and _valido(dados):
            gerado = {
                "enunciado": dados["enunciado"].strip(),
                "opcoes": [o.strip() for o in dados["opcoes"]],
                "indiceCorreta": dados["indiceCorreta"],
                "explicacao": str(dados.get("explicacao", "")).strip(),
                "apoio": None,
                "origem": "ia",
            }

    if gerado is None:  # fallback: banco curado
        base = _do_banco(habilidade_id, nivel)
        if base is None:
            raise ValueError(f"Sem exercício disponível para {habilidade_id}")
        gerado = {**base, "origem": "banco"}

    return {
        "habilidadeId": habilidade_id,
        "habilidade": hab["nome"],
        "disciplina": hab["disciplina"],
        "nivel": nivel,
        **gerado,
    }
