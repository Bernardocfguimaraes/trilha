from __future__ import annotations

REGISTROS_PARA_CONCLUIR = 3
TAMANHO_FRENTE = 3

Info = dict[str, tuple[str | None, int]]


def concluida(status: str | None, n_registros: int) -> bool:
    return status == "ok" and n_registros >= REGISTROS_PARA_CONCLUIR


def _pendentes(ordem: list[str], info: Info) -> list[str]:
    return [h for h in ordem if not concluida(*info.get(h, (None, 0)))]


def frente(ordem: list[str], info: Info) -> list[str]:
    if not ordem:
        return []
    pendentes = _pendentes(ordem, info)
    if not pendentes:
        return ordem[-TAMANHO_FRENTE:]
    escolhidas = pendentes[:TAMANHO_FRENTE]
    revisao = [h for h in ordem if info.get(h, (None, 0))[0] == "alerta" and h not in escolhidas]
    return escolhidas + revisao[:1]


def progresso(ordem: list[str], info: Info) -> dict:
    pendentes = _pendentes(ordem, info)
    return {
        "total": len(ordem),
        "concluidas": len(ordem) - len(pendentes),
        "atual": pendentes[0] if pendentes else None,
        "proximas": pendentes[1:TAMANHO_FRENTE],
    }


def formatar_progresso(disciplina_id: str, disciplina_nome: str, ano: int, p: dict, habs: dict[str, dict]) -> dict:
    def ref(hid: str | None) -> dict | None:
        if hid is None:
            return None
        h = habs[hid]
        return {"habilidadeId": hid, "nome": h["nome"], "codigoBncc": h.get("codigoBncc")}

    return {
        "disciplinaId": disciplina_id,
        "disciplina": disciplina_nome,
        "ano": ano,
        "total": p["total"],
        "concluidas": p["concluidas"],
        "atual": ref(p["atual"]),
        "proximas": [ref(h) for h in p["proximas"]],
    }
