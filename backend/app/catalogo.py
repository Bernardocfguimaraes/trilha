"""Catálogo BNCC por ano e disciplina.

Os dados ficam em app/bncc/:
  oficial_ef.json        texto oficial de todas as habilidades do EF (código -> descrição),
                         extraído do documento do MEC por app/bncc/extrair.py
  caminhos/AA-disc.json  o "caminho" de um ano/disciplina: unidades e habilidades em ordem,
                         com título curto para a interface e se a habilidade é avaliável
                         por quiz (produção e oralidade ficam "em sala")
  perguntas/AA-disc.json questões geradas por IA (app/bncc/gerar_perguntas.py), já
                         validadas; o banco curado de dados.py continua como fallback

O id da habilidade no app é o próprio código BNCC (ex.: EF04LP01). Um código pode valer
para vários anos (EF15LP, EF35LP, EF69LP...), por isso a relação com o ano vem do caminho,
não da habilidade.

Só usa a biblioteca padrão; nada aqui importa dados.py (dados.py é que importa daqui).
"""
from __future__ import annotations

import glob
import hashlib
import json
import os
import random
import re
from functools import lru_cache

_DIR = os.path.join(os.path.dirname(__file__), "bncc")
_RE_CODIGO = re.compile(r"^EF(\d)(\d)[A-Z]{2}\d{2}$")


@lru_cache(maxsize=1)
def oficial() -> dict[str, str]:
    with open(os.path.join(_DIR, "oficial_ef.json"), encoding="utf-8") as f:
        return json.load(f)["habilidades"]


def cobre_ano(codigo: str, ano: int) -> bool:
    """EF04LP01 vale só para o 4º ano; EF35LP03 vale do 3º ao 5º; EF69LP01 do 6º ao 9º."""
    m = _RE_CODIGO.match(codigo)
    if not m:
        return False
    a, b = int(m.group(1)), int(m.group(2))
    return ano == b if a == 0 else a <= ano <= b


def _arquivo_caminho(ano: int, disciplina_id: str) -> str:
    return os.path.join(_DIR, "caminhos", f"{ano:02d}-{disciplina_id}.json")


@lru_cache(maxsize=None)
def _caminho_bruto(ano: int, disciplina_id: str) -> dict | None:
    caminho = _arquivo_caminho(ano, disciplina_id)
    if not os.path.exists(caminho):
        return None
    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    _validar(dados, ano, caminho)
    return dados


def _validar(dados: dict, ano: int, origem: str) -> None:
    """Falha cedo (na carga) se o caminho referenciar código inexistente, repetido ou de outro ano."""
    textos = oficial()
    vistos: set[str] = set()
    for u in dados["unidades"]:
        for h in u["habilidades"]:
            c = h["codigo"]
            if c not in textos:
                raise ValueError(f"{origem}: {c} não existe na BNCC (oficial_ef.json)")
            if c in vistos:
                raise ValueError(f"{origem}: {c} aparece duas vezes no caminho")
            if not cobre_ano(c, ano):
                raise ValueError(f"{origem}: {c} não é habilidade do {ano}º ano")
            vistos.add(c)


def tem_caminho(ano: int, disciplina_id: str) -> bool:
    return _caminho_bruto(ano, disciplina_id) is not None


def caminho(ano: int, disciplina_id: str, disciplina_nome: str) -> list[dict]:
    """Habilidades do caminho, em ordem, no formato do catálogo do app.

    Inclui as não avaliáveis (avaliavel=False) — o professor vê o caminho inteiro; quem
    filtra para o quiz/diagnóstico é quem chama.
    """
    dados = _caminho_bruto(ano, disciplina_id)
    if dados is None:
        return []
    textos = oficial()
    saida = []
    for u in dados["unidades"]:
        for h in u["habilidades"]:
            saida.append({
                "id": h["codigo"],
                "codigoBncc": h["codigo"],
                "nome": h["nome"],
                "disciplina": disciplina_nome,
                "descricao": textos[h["codigo"]],
                "ano": ano,
                "unidade": u["nome"],
                "avaliavel": h.get("avaliavel", True),
                "dica": h.get("dica"),  # orientação de conteúdo para o gerador/revisor de IA
            })
    return saida


def _embaralhar(q: dict) -> dict:
    """Ordem das opções sorteada por questão (determinística: semente = id). Nos arquivos a
    resposta certa às vezes se acumula numa posição; sorteando, "chutar sempre a última"
    deixa de funcionar e cada aluno vê a mesma ordem em toda sessão."""
    ordem = list(range(len(q["opcoes"])))
    random.Random(hashlib.sha256(q["id"].encode()).hexdigest()).shuffle(ordem)
    return {**q, "opcoes": [q["opcoes"][i] for i in ordem], "certa": ordem.index(q["certa"])}


def perguntas_geradas() -> list[dict]:
    """Todas as questões dos caminhos BNCC gravadas em app/bncc/perguntas/*.json, com a
    ordem das opções sorteada."""
    saida: list[dict] = []
    for arq in sorted(glob.glob(os.path.join(_DIR, "perguntas", "*.json"))):
        with open(arq, encoding="utf-8") as f:
            saida.extend(_embaralhar(q) for q in json.load(f)["perguntas"])
    return saida
