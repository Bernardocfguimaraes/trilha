"""Extrai o texto oficial das habilidades da BNCC (Ensino Fundamental) para oficial_ef.json.

Fonte: documento oficial do MEC (versão final homologada), em
http://basenacionalcomum.mec.gov.br/images/BNCC_EI_EF_110518_versaofinal_site.pdf

Uso (uma vez; o JSON gerado fica versionado no repositório):

    pdftotext -enc UTF-8 BNCC_EI_EF_110518_versaofinal_site.pdf bncc.txt
    python -m app.bncc.extrair bncc.txt

O catálogo do app (catalogo.py) nunca guarda a descrição oficial em outro lugar: os
arquivos de caminho referenciam só o código, e a descrição vem sempre daqui. Assim não
há texto da BNCC digitado à mão.
"""
from __future__ import annotations

import json
import os
import re
import sys

_PAT = re.compile(r"\((EF\d{2}[A-Z]{2}\d{2})\)\s*(.+?)(?=\(EF\d{2}[A-Z]{2}\d{2}\)|\n\s*\n|\Z)", re.S)
# Cabeçalhos de página que o pdftotext às vezes cola no fim de uma habilidade.
_CABECALHO = re.compile(
    r"\s+(BASE NACIONAL COMUM CURRICULAR|LINGUAGENS –|MATEMÁTICA –|CIÊNCIAS DA NATUREZA|"
    r"CIÊNCIAS HUMANAS|ENSINO RELIGIOSO –|LÍNGUA PORTUGUESA –|HABILIDADES\b).*$",
    re.S,
)
_NUM_PAGINA = re.compile(r"\s+\d{2,3}$")

FONTE = "BNCC – Ensino Fundamental, versão final homologada (MEC). basenacionalcomum.mec.gov.br"
SAIDA = os.path.join(os.path.dirname(__file__), "oficial_ef.json")


def extrair(texto: str) -> dict[str, str]:
    saida: dict[str, str] = {}
    for codigo, desc in _PAT.findall(texto):
        d = " ".join(desc.split())
        d = _CABECALHO.sub("", d)
        d = _NUM_PAGINA.sub("", d).strip()
        if codigo not in saida or len(d) > len(saida[codigo]):
            saida[codigo] = d
    return dict(sorted(saida.items()))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("uso: python -m app.bncc.extrair bncc.txt")
    with open(sys.argv[1], encoding="utf-8") as f:
        habilidades = extrair(f.read())
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump({"fonte": FONTE, "habilidades": habilidades}, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{len(habilidades)} habilidades gravadas em {SAIDA}")
