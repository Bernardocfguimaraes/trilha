"""Geração do texto de recomendação pedagógica (passo 4).

Quando um aluno fica em alerta/atenção numa habilidade, o texto que o responsável/professor
lê pode vir de um LLM. Para controlar custo (ponto 1 do professor), geramos só quando há
alerta/atenção e guardamos em cache por (habilidade, status) — não refazemos o mesmo texto.

Sem LLM configurado (ou se a chamada falhar), usamos os textos prontos de dados.py (TEXTOS).
"""
from __future__ import annotations

from . import llm
from .dados import TEXTOS

_cache: dict[tuple[str, str], str] = {}

_SISTEMA = (
    "Você é um apoio pedagógico do ensino fundamental (anos iniciais). Escreva uma recomendação "
    "curta (2 a 4 frases), prática e acolhedora, para o responsável ou professor ajudar a criança "
    "numa habilidade específica. Linguagem simples, sem jargão, sem listar bullet points. "
    "Sugira uma atividade concreta do dia a dia. Não invente dados do aluno além do que for informado."
)


def texto_para(habilidade_id: str, habilidade_nome: str, disciplina: str, status: str) -> str:
    """Recomendação para uma habilidade num dado status. Cacheia por (habilidade, status)."""
    chave = (habilidade_id, status)
    if chave in _cache:
        return _cache[chave]

    texto = None
    if llm.disponivel():
        nivel = "dificuldade significativa (alerta)" if status == "alerta" else "sinais de atenção"
        prompt = (
            f"Habilidade: {habilidade_nome} ({disciplina}). "
            f"A criança está com {nivel} nesta habilidade. "
            f"Escreva a recomendação para quem acompanha a criança."
        )
        texto = llm.gerar(_SISTEMA, [{"role": "user", "content": prompt}], max_tokens=500)

    if not texto:  # fallback: texto pronto (ou genérico se não houver)
        texto = TEXTOS.get(habilidade_id, "Recomendação em preparação.")

    _cache[chave] = texto
    return texto
