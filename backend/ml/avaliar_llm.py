"""Avaliação do LLM: o revisor de questões funciona? Vale a pena ele ser de outro modelo?

Contexto: na geração em lote, quando o próprio gerador (gpt-oss-120b) revisava as questões
que tinha feito, cerca de 30% das aprovadas ainda tinham erro (gabarito errado, duas
respostas certas). Por isso o revisor passou a ser outro modelo (qwen). Este script mede
isso de forma reproduzível, com gabarito conhecido:

1. Questões CORRETAS: amostra do banco curado (revisado por pessoas). O revisor deve aprovar.
2. Questões com ERRO PLANTADO: as mesmas questões com o gabarito trocado para uma opção
   errada. O revisor deve reprovar. Como sabemos onde está o erro, dá para medir
   quantos erros cada revisor pega (recall) e quantas questões boas ele recusa à toa.
3. Geração ao vivo: o gerador cria questões novas; contamos quantas passam no checador de
   formato (Python) e quanto cada revisor aprova, e onde os dois discordam.

Os dois revisores usam o MESMO prompt (exercicios._SISTEMA_REVISOR) e a mesma regra de
aprovação; só muda o modelo: "auto" = o próprio gerador, "outro" = o modelo revisor.

Usa só o plano gratuito: amostra pequena e respostas guardadas em ml/avaliacao_llm_cache.jsonl
(se a cota do dia acabar, rodar de novo continua de onde parou).

Uso: python -m ml.avaliar_llm [--n 20] [--gerar 10]
Saída: app/avaliacao_llm.json (lido pela página do modelo) e ml/relatorio_llm.txt.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), os.pardir, ".env"))  # antes de app.llm ler as chaves

from app import exercicios, llm  # noqa: E402
from app.dados import BANCO, HAB_POR_ID  # noqa: E402

AQUI = os.path.dirname(__file__)
CACHE = os.path.join(AQUI, "avaliacao_llm_cache.jsonl")
SAIDA = os.path.join(AQUI, os.pardir, "app", "avaliacao_llm.json")
RELATORIO = os.path.join(AQUI, "relatorio_llm.txt")
SEMENTE = 11


def _carregar_cache() -> dict:
    cache = {}
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            for linha in f:
                if linha.strip():
                    item = json.loads(linha)
                    cache[item["chave"]] = item["resposta"]
    return cache


def _chave(*partes) -> str:
    return hashlib.sha1(json.dumps(partes, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def _guardar(chave: str, resposta) -> None:
    with open(CACHE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"chave": chave, "resposta": resposta}, ensure_ascii=False) + "\n")


def revisar(cache: dict, revisor: str, hab: dict, q: dict) -> dict | None:
    """Veredito do revisor ("auto" = gerador, "outro" = modelo revisor), com a mesma regra de
    aprovação de exercicios._revisar. None se o LLM não respondeu (cota, rede)."""
    papel = "revisor" if revisor == "outro" else "geral"
    modelo = llm.modelos()["revisor" if revisor == "outro" else "gerador"]
    opcoes = "\n".join(f"{i}. {o}" for i, o in enumerate(q["opcoes"]))
    prompt = (
        f"Habilidade ({hab.get('codigoBncc') or hab['nome']}): {hab['descricao']}\n"
        f"Ano: {hab.get('ano') or 4}º ano do ensino fundamental.\n"
        + (f"Nota do especialista sobre a habilidade: {hab['dica']}\n" if hab.get("dica") else "")
        + f"\nQuestão: {q['enunciado']}\n{opcoes}"
    )
    chave = _chave("revisar", modelo, prompt)
    if chave not in cache:
        bruto = llm.gerar(exercicios._SISTEMA_REVISOR, [{"role": "user", "content": prompt}], temperatura=0.0,
                          max_tokens=4000, papel=papel)
        if bruto is None:
            return None
        cache[chave] = bruto
        _guardar(chave, bruto)
    r = exercicios._extrair_json(cache[chave] or "")
    if not isinstance(r, dict):
        return {"aprovada": False, "resposta": None, "motivo": "resposta fora do formato"}
    aprovada = (
        r.get("resposta") == q["indiceCorreta"]
        and r.get("unicaCorreta") is True
        and r.get("conteudoCorreto") is True
        and r.get("avaliaHabilidade") is True
    )
    return {"aprovada": aprovada, "resposta": r.get("resposta"), "motivo": str(r.get("problema") or "")[:200]}


def gerar_questao(cache: dict, hab_id: str, i: int) -> dict | None:
    hab = HAB_POR_ID[hab_id]
    sistema = exercicios._sistema(hab.get("ano") or 4)
    prompt = exercicios._prompt(hab, "medio", [])
    chave = _chave("gerar", llm.modelos()["gerador"], sistema, prompt, i)
    if chave not in cache:
        bruto = llm.gerar(sistema, [{"role": "user", "content": prompt}], max_tokens=1200)
        if bruto is None:
            return None
        cache[chave] = bruto
        _guardar(chave, bruto)
    dados = exercicios._extrair_json(cache[chave] or "")
    return {"dados": dados, "valida": bool(dados) and exercicios._valido(dados)}


def _taxa(a: int, b: int) -> float | None:
    return round(a / b, 4) if b else None


def avaliar(n: int, n_gerar: int) -> dict:
    if not llm.disponivel() or not llm.modelos()["revisor"]:
        raise SystemExit("Configure LLM_API_KEY e LLM_REVISOR_MODEL no backend/.env para avaliar.")
    llm.ESPERAR_LIMITE = True  # respeita o limite por minuto; para no limite do dia
    cache = _carregar_cache()
    rng = random.Random(SEMENTE)

    # Amostra estratificada por disciplina do banco curado (só questões revisadas por pessoas).
    curadas = [p for p in BANCO if p["origem"] == "curada" and not p.get("apoio") and p["habilidadeId"] in HAB_POR_ID]
    por_disc: dict[str, list] = {}
    for p in curadas:
        por_disc.setdefault(HAB_POR_ID[p["habilidadeId"]]["disciplina"], []).append(p)
    for lista in por_disc.values():
        rng.shuffle(lista)
    amostra, i = [], 0
    while len(amostra) < n and any(por_disc.values()):
        lista = list(por_disc.values())[i % len(por_disc)]
        if lista:
            amostra.append(lista.pop())
        i += 1

    casos = []
    for p in amostra:
        certa = {"enunciado": p["enunciado"], "opcoes": p["opcoes"], "indiceCorreta": p["certa"]}
        errada_idx = rng.choice([j for j in range(4) if j != p["certa"]])
        casos.append(("correta", p, certa))
        casos.append(("erro_plantado", p, {**certa, "indiceCorreta": errada_idx}))

    resultados = {"auto": [], "outro": []}
    interrompido = False
    try:
        for tipo, p, q in casos:
            hab = HAB_POR_ID[p["habilidadeId"]]
            for rev in ("auto", "outro"):
                v = revisar(cache, rev, hab, q)
                if v is not None:
                    resultados[rev].append({"tipo": tipo, "id": p["id"], "disciplina": hab["disciplina"], **v})
    except llm.CotaEsgotada as e:
        interrompido = str(e)

    def resumo(lista):
        boas = [r for r in lista if r["tipo"] == "correta"]
        ruins = [r for r in lista if r["tipo"] == "erro_plantado"]
        pegos = sum(1 for r in ruins if not r["aprovada"])
        recusadas = sum(1 for r in boas if not r["aprovada"])
        aprovadas_ruins = sum(1 for r in ruins if r["aprovada"])
        aprovadas = aprovadas_ruins + (len(boas) - recusadas)
        return {
            "avaliadas": len(lista),
            "errosPegos": _taxa(pegos, len(ruins)),             # recall sobre os erros plantados
            "boasRecusadas": _taxa(recusadas, len(boas)),        # falso alarme
            "erroEntreAprovadas": _taxa(aprovadas_ruins, aprovadas),  # o que chegaria ao aluno com erro (amostra 50/50)
            "nCorretas": len(boas),
            "nErros": len(ruins),
        }

    # Geração ao vivo.
    geracao = {"pedidas": 0, "validasFormato": 0, "aprovadasAuto": 0, "aprovadasOutro": 0,
               "discordancias": 0, "exemplosDiscordancia": []}
    if not interrompido and n_gerar:
        habs = sorted({p["habilidadeId"] for p in amostra})
        rng.shuffle(habs)
        try:
            for k in range(n_gerar):
                hab_id = habs[k % len(habs)]
                g = gerar_questao(cache, hab_id, k)
                if g is None:
                    continue
                geracao["pedidas"] += 1
                if not g["valida"]:
                    continue
                geracao["validasFormato"] += 1
                hab = HAB_POR_ID[hab_id]
                va, vo = revisar(cache, "auto", hab, g["dados"]), revisar(cache, "outro", hab, g["dados"])
                if va is None or vo is None:
                    continue
                geracao["aprovadasAuto"] += va["aprovada"]
                geracao["aprovadasOutro"] += vo["aprovada"]
                if va["aprovada"] != vo["aprovada"]:
                    geracao["discordancias"] += 1
                    if len(geracao["exemplosDiscordancia"]) < 3:
                        geracao["exemplosDiscordancia"].append({
                            "habilidade": hab["nome"], "enunciado": g["dados"]["enunciado"][:300],
                            "opcoes": g["dados"]["opcoes"], "gabarito": g["dados"]["indiceCorreta"],
                            "auto": va, "outro": vo,
                        })
        except llm.CotaEsgotada as e:
            interrompido = str(e)

    m = llm.modelos()
    saida = {
        "avaliadoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "modelos": {"gerador": m["gerador"], "revisor": m["revisor"]},
        "metodo": {
            "amostra": len(amostra),
            "descricao": "Questões do banco curado (gabarito conhecido) e as mesmas com o gabarito trocado para uma opção errada.",
            "semente": SEMENTE,
        },
        "autoRevisao": resumo(resultados["auto"]),
        "outroModelo": resumo(resultados["outro"]),
        "geracao": geracao,
        "interrompido": interrompido or None,
    }
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)

    pct = lambda v: "—" if v is None else f"{v:.0%}"
    a, o = saida["autoRevisao"], saida["outroModelo"]
    linhas = [
        "=== Avaliação do LLM — revisor de questões ===",
        f"Gerador: {m['gerador']}   Revisor: {m['revisor']}",
        f"Amostra: {len(amostra)} questões curadas + {len(amostra)} com gabarito trocado",
        f"Auto-revisão ({m['gerador']}): erros pegos {pct(a['errosPegos'])}, boas recusadas {pct(a['boasRecusadas'])}, erro entre aprovadas {pct(a['erroEntreAprovadas'])} ({a['avaliadas']} vereditos)",
        f"Outro modelo ({m['revisor']}): erros pegos {pct(o['errosPegos'])}, boas recusadas {pct(o['boasRecusadas'])}, erro entre aprovadas {pct(o['erroEntreAprovadas'])} ({o['avaliadas']} vereditos)",
        f"Geração ao vivo: {geracao['pedidas']} pedidas, {geracao['validasFormato']} no formato, aprovadas auto {geracao['aprovadasAuto']}, outro {geracao['aprovadasOutro']}, discordâncias {geracao['discordancias']}",
    ]
    if interrompido:
        linhas.append(f"INTERROMPIDO: {interrompido} — rode de novo amanhã para completar (o cache guarda o que já foi feito).")
    print("\n".join(linhas))
    with open(RELATORIO, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    return saida


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=20, help="questões curadas na amostra (cada uma vira 2 casos)")
    ap.add_argument("--gerar", type=int, default=10, help="questões geradas ao vivo")
    args = ap.parse_args()
    avaliar(args.n, args.gerar)
