"""Grupos de reforço: k-means sobre o perfil de desempenho dos alunos (aprendizado não
supervisionado — não há rótulo; o algoritmo encontra perfis parecidos sozinho).

Cada aluno vira um vetor: a média recente (últimos 3 dias) em cada habilidade que a turma
já praticou. Onde o aluno ainda não praticou, usamos a média da turma naquela habilidade
(não puxa o aluno para nenhum grupo). O número de grupos (2 a 4) é escolhido pelo maior
coeficiente de silhueta. Cada grupo é descrito pelas habilidades em que ele fica bem abaixo
da turma — é o foco do reforço.

Python puro (sem scikit-learn), determinístico (semente fixa), para turmas de sala de aula.
"""
from __future__ import annotations

import math
import random

MIN_ALUNOS = 4
SEMENTE = 13


def _dist(a: list[float], b: list[float]) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def _media(vs: list[list[float]]) -> list[float]:
    return [sum(c) / len(vs) for c in zip(*vs)]


def kmeans(pontos: list[list[float]], k: int, iteracoes: int = 100) -> list[int]:
    """k-means com inicialização k-means++ e semente fixa. Devolve o grupo de cada ponto."""
    rng = random.Random(SEMENTE)
    centros = [pontos[rng.randrange(len(pontos))]]
    while len(centros) < k:
        d2 = [min(_dist(p, c) ** 2 for c in centros) for p in pontos]
        total = sum(d2)
        if total == 0:
            break
        alvo, acum = rng.random() * total, 0.0
        for p, d in zip(pontos, d2):
            acum += d
            if acum >= alvo:
                centros.append(p)
                break
    rotulos = [0] * len(pontos)
    for _ in range(iteracoes):
        novos = [min(range(len(centros)), key=lambda j: _dist(p, centros[j])) for p in pontos]
        if novos == rotulos and _ > 0:
            break
        rotulos = novos
        for j in range(len(centros)):
            membros = [p for p, r in zip(pontos, rotulos) if r == j]
            if membros:
                centros[j] = _media(membros)
    return rotulos


def silhueta(pontos: list[list[float]], rotulos: list[int]) -> float:
    """Coeficiente de silhueta médio (−1 a 1): quanto cada aluno está mais perto do próprio
    grupo do que do grupo vizinho."""
    grupos = set(rotulos)
    if len(grupos) < 2:
        return -1.0
    valores = []
    for i, p in enumerate(pontos):
        mesmo = [_dist(p, q) for j, q in enumerate(pontos) if rotulos[j] == rotulos[i] and j != i]
        if not mesmo:
            valores.append(0.0)
            continue
        a = sum(mesmo) / len(mesmo)
        b = min(
            sum(_dist(p, q) for j, q in enumerate(pontos) if rotulos[j] == g) / rotulos.count(g)
            for g in grupos if g != rotulos[i]
        )
        valores.append((b - a) / max(a, b) if max(a, b) > 0 else 0.0)
    return sum(valores) / len(valores)


def formar_grupos(alunos: list[dict], habilidades: list[dict]) -> dict:
    """alunos: [{id, nome, recentes: {habilidadeId: média recente}}]
    habilidades: [{habilidadeId, nome, disciplina}] (as que a turma já praticou)."""
    com_dados = [a for a in alunos if a["recentes"]]
    if len(com_dados) < MIN_ALUNOS or not habilidades:
        return {"grupos": [], "k": 0, "silhueta": None, "alunosConsiderados": len(com_dados),
                "observacao": f"É preciso que pelo menos {MIN_ALUNOS} alunos tenham feito atividades para formar grupos."}

    ids = [h["habilidadeId"] for h in habilidades]
    media_turma = {}
    for hid in ids:
        vals = [a["recentes"][hid] for a in com_dados if hid in a["recentes"]]
        media_turma[hid] = sum(vals) / len(vals) if vals else 0.0
    pontos = [[a["recentes"].get(hid, media_turma[hid]) for hid in ids] for a in com_dados]

    melhor = None
    for k in range(2, min(4, len(com_dados) - 1) + 1):
        rot = kmeans(pontos, k)
        if len(set(rot)) < k:
            continue
        s = silhueta(pontos, rot)
        if melhor is None or s > melhor[0]:
            melhor = (s, k, rot)
    if melhor is None:
        return {"grupos": [], "k": 0, "silhueta": None, "alunosConsiderados": len(com_dados),
                "observacao": "Os alunos têm perfis muito parecidos: não há grupos diferentes para formar."}

    s, k, rotulos = melhor
    por_id = {h["habilidadeId"]: h for h in habilidades}
    grupos = []
    for g in range(k):
        membros = [a for a, r in zip(com_dados, rotulos) if r == g]
        centro = _media([p for p, r in zip(pontos, rotulos) if r == g])
        # Foco: habilidades em que o grupo fica bem abaixo da turma e abaixo de 70.
        foco = sorted(
            (
                {**por_id[hid], "mediaGrupo": round(c), "mediaTurma": round(media_turma[hid])}
                for hid, c in zip(ids, centro)
                if c < 70 and c <= media_turma[hid] - 5
            ),
            key=lambda f: f["mediaGrupo"] - f["mediaTurma"],
        )[:3]
        grupos.append({
            "alunos": sorted(({"id": a["id"], "nome": a["nome"]} for a in membros), key=lambda a: a["nome"]),
            "foco": foco,
            "mediaGeral": round(sum(centro) / len(centro)),
        })
    # Quem mais precisa primeiro.
    grupos.sort(key=lambda g: (len(g["foco"]) == 0, g["mediaGeral"]))
    for i, g in enumerate(grupos, 1):
        g["nome"] = f"Grupo {i}"
    return {"grupos": grupos, "k": k, "silhueta": round(s, 3), "alunosConsiderados": len(com_dados), "observacao": None}
