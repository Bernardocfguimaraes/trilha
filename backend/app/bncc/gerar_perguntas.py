"""Gera, em lote, as questões de um caminho BNCC (ano + disciplina) com a IA.

    python -m app.bncc.gerar_perguntas 4 por            # 3 questões por nível (padrão)
    python -m app.bncc.gerar_perguntas 4 por --por-nivel 4

Cada questão aceita custa ao menos 2 chamadas ao LLM (gerador + revisor independente, ver
exercicios._revisar), mais as descartadas. Tudo cabe no plano gratuito, sem custo:
  - gerador e revisor em modelos diferentes da Groq (LLM_MODEL e LLM_REVISOR_MODEL): o limite
    gratuito é por modelo, então cada papel tem a própria cota diária;
  - provedor de reserva opcional (LLM_RESERVA_*, ex.: Gemini grátis) quando a cota acaba;
  - quando todos esgotam, o lote para sozinho e grava o que já fez. Como é incremental, basta
    rodar de novo no dia seguinte: ele continua de onde parou.
As questões ficam versionadas no repositório: gerar é trabalho de uma vez só, e o app ao vivo
não gasta cota com isso.

Para cada habilidade AVALIÁVEL do caminho e cada nível (fácil/médio/difícil), pede questões
ao LLM pelo mesmo gerador do professor (exercicios.gerar_exercicio), com as mesmas
validações (4 opções distintas, sem valores equivalentes, índice válido) e passando os
enunciados já existentes para não repetir. Saída em app/bncc/perguntas/AA-disc.json
(dá para revisar no diff e remover uma questão ruim à mão; o id removido é refeito na
próxima rodada).

As opções são embaralhadas de forma determinística (o LLM tende a pôr a certa no início).
"""
from __future__ import annotations

import argparse
import json
import os
import random
import threading
from concurrent.futures import ThreadPoolExecutor

from .. import bd  # noqa: F401  (carrega o .env antes de importar o llm)
from .. import exercicios, llm
from ..dados import HABILIDADES, TURMA, nome_disciplina

NIVEIS = ("facil", "medio", "dificil")
_DIR = os.path.join(os.path.dirname(__file__), "perguntas")
_trava = threading.Lock()
_parar = threading.Event()  # cota do dia acabou: as outras threads param também


def _arquivo(ano: int, disciplina_id: str) -> str:
    return os.path.join(_DIR, f"{ano:02d}-{disciplina_id}.json")


def _carregar(caminho: str) -> dict:
    if not os.path.exists(caminho):
        return {"perguntas": []}
    with open(caminho, encoding="utf-8") as f:
        return json.load(f)


def _gravar(caminho: str, meta: dict, ano: int, disciplina_id: str, perguntas: list[dict]) -> None:
    ordem = {h["id"]: i for i, h in enumerate(HABILIDADES)}
    perguntas = sorted(perguntas, key=lambda p: (ordem.get(p["habilidadeId"], 999), NIVEIS.index(p["nivel"]), p["id"]))
    # Mantém anotações do arquivo (ex.: revisão humana) e registra quem gerou e quem revisou.
    saida = {**meta, "ano": ano, "disciplinaId": disciplina_id, "modelo": llm.modelos(), "perguntas": perguntas}
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)
        f.write("\n")


def _embaralhar(id_: str, opcoes: list[str], certa: int) -> tuple[list[str], int]:
    ordem = list(range(len(opcoes)))
    random.Random(id_).shuffle(ordem)
    return [opcoes[i] for i in ordem], ordem.index(certa)


def _gerar_habilidade(hab: dict, por_nivel: int, todas: list[dict], salvar) -> int:
    novas = 0
    for nivel in NIVEIS:
        for k in range(1, por_nivel + 1):
            if _parar.is_set():
                return novas
            id_ = f"{hab['id'].lower()}-{nivel[0]}{k}"
            with _trava:
                if any(p["id"] == id_ for p in todas):
                    continue
                evitar = [p["enunciado"] for p in todas if p["habilidadeId"] == hab["id"]]
            try:
                ex = exercicios.gerar_exercicio(hab["id"], nivel, evitar=evitar, usar_banco=False, revisar=True)
            except llm.CotaEsgotada as e:
                print(f"  ! {e}. Parando; rode de novo amanhã para continuar.")
                _parar.set()
                return novas
            except ValueError as e:
                print(f"  ! {e}")
                continue
            if any(ex["enunciado"].strip().lower() == e.strip().lower() for e in evitar):
                print(f"  ! repetida, descartada: {id_}")
                continue
            opcoes, certa = _embaralhar(id_, ex["opcoes"], ex["indiceCorreta"])
            p = {
                "id": id_, "habilidadeId": hab["id"], "nivel": nivel, "enunciado": ex["enunciado"],
                "apoio": None, "opcoes": opcoes, "certa": certa, "explicacao": ex["explicacao"], "origem": "ia",
            }
            with _trava:
                todas.append(p)
                salvar()
            novas += 1
    print(f"  {hab['id']} {hab['nome']}: +{novas}")
    return novas


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("ano", type=int)
    ap.add_argument("disciplina")
    ap.add_argument("--por-nivel", type=int, default=3)
    ap.add_argument("--paralelo", type=int, default=2)
    args = ap.parse_args()

    if not llm.disponivel():
        raise SystemExit("LLM_API_KEY não configurado no backend/.env.")
    llm.ESPERAR_LIMITE = True  # lote: respeita o limite por minuto e para no limite do dia
    llm.TIMEOUT = 180          # o revisor raciocina mais e pode passar dos 30s do modo ao vivo
    if args.ano != TURMA["ano"]:
        raise SystemExit(f"O catálogo carregado é do {TURMA['ano']}º ano (TURMA['ano']).")
    nome = nome_disciplina(args.disciplina)
    habs = [h for h in HABILIDADES if h["disciplina"] == nome and h.get("codigoBncc")]
    if not habs:
        raise SystemExit(f"Sem caminho BNCC para {args.ano}º ano / {args.disciplina}.")

    os.makedirs(_DIR, exist_ok=True)
    caminho = _arquivo(args.ano, args.disciplina)
    meta = _carregar(caminho)
    todas: list[dict] = meta.pop("perguntas")

    def salvar():
        _gravar(caminho, meta, args.ano, args.disciplina, todas)

    print(f"{len(habs)} habilidades, {args.por_nivel} por nível; já existem {len(todas)} questões.")
    print(f"Modelos: {llm.modelos()}")
    with ThreadPoolExecutor(max_workers=args.paralelo) as ex:
        total = sum(ex.map(lambda h: _gerar_habilidade(h, args.por_nivel, todas, salvar), habs))
    ids = {h["id"] for h in habs}
    faltam = len(habs) * len(NIVEIS) * args.por_nivel - sum(p["habilidadeId"] in ids for p in todas)
    print(f"Pronto: +{total} questões ({len(todas)} no total) em {caminho}. Faltam ~{max(faltam, 0)}.")


if __name__ == "__main__":
    main()
