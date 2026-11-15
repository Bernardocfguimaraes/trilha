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
                "dica": h.get("dica"),
            })
    return saida


def _embaralhar(q: dict) -> dict:
    ordem = list(range(len(q["opcoes"])))
    random.Random(hashlib.sha256(q["id"].encode()).hexdigest()).shuffle(ordem)
    return {**q, "opcoes": [q["opcoes"][i] for i in ordem], "certa": ordem.index(q["certa"])}


def perguntas_geradas() -> list[dict]:
    saida: list[dict] = []
    for arq in sorted(glob.glob(os.path.join(_DIR, "perguntas", "*.json"))):
        with open(arq, encoding="utf-8") as f:
            saida.extend(_embaralhar(q) for q in json.load(f)["perguntas"])
    return saida
