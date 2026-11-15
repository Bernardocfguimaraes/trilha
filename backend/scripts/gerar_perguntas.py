from __future__ import annotations

import argparse
import json
import os
import random
import threading
from concurrent.futures import ThreadPoolExecutor

from app import bd, exercicios, llm
from app.dados import HABILIDADES, TURMA, nome_disciplina

NIVEIS = ("facil", "medio", "dificil")
_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "app", "bncc", "perguntas")
_trava = threading.Lock()
_parar = threading.Event()


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
    llm.ESPERAR_LIMITE = True
    llm.TIMEOUT = 180
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
