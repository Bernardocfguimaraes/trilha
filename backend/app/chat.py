"""PLACEHOLDER do chat da turma — port de src/lib/mock-chat.ts.

No produto, a resposta vem de um LLM que recebe a pergunta, o histórico da conversa e
os dados de desempenho da turma. Aqui escolhemos textos prontos por palavra-chave sobre
um retrato da turma, só para a demo. Esta é a camada que será trocada pelo LLM real.
"""
from __future__ import annotations

import re
import unicodedata
from typing import TypedDict


class HabilidadeRetrato(TypedDict):
    id: str
    nome: str
    disciplina: str
    alerta: list[str]
    atencao: list[str]


class RetratoTurma(TypedDict):
    turma: str
    habilidades: list[HabilidadeRetrato]
    evolucao: list[dict]  # {aluno, variacao}
    semAtividade: list[str]


def _normalizar(s: str) -> str:
    sem_acento = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return sem_acento.lower()


_TEMAS: list[tuple[str, str]] = [
    (r"fraca|fracoes|metade|terco|quarto", "mat-fracoes"),
    (r"multiplica|tabuada|vezes", "mat-mult"),
    (r"adicao|subtracao|soma|conta|reagrup|vai um", "mat-adicao"),
    (r"problema|enunciado", "mat-problemas"),
    (r"leitura|interpreta|compreens|texto", "por-leitura"),
    (r"ortografia|escrita|ditado|palavra", "por-ortografia"),
    (r"producao|redacao|frase completa", "por-producao"),
    (r"mapa|cardea|orienta|bussola", "geo-orientacao"),
    (r"paisagem|campo|cidade", "geo-paisagem"),
    (r"cadeia|animal|planta|seres vivos", "cie-seres-vivos"),
    (r"agua|materia|vapor|gelo", "cie-materia"),
    (r"cumpriment|dialogo|frases em ingles", "ing-frases"),
    (r"vocabul|ingles|cores", "ing-vocabulario"),
]

_ATIVIDADES: dict[str, str] = {
    "mat-fracoes": "Pizza de papel (30 min)\n1. Cada dupla recebe 3 círculos de papel do mesmo tamanho.\n2. Dobram e recortam: um em 2, outro em 3, outro em 4 partes iguais.\n3. Comparam lado a lado: \"qual pedaço é maior, 1/3 ou 1/4?\" e registram no caderno.\n4. Fechamento: 4 perguntas rápidas no quadro (\"metade de 8 balas\", \"um quarto de 12\").\nDica: deixe que eles errem a comparação primeiro e confiram com os recortes.",
    "mat-mult": "Bingo da tabuada (25 min)\n1. Cada aluno monta uma cartela 3×3 com resultados da tabuada do 6 ao 9.\n2. Você sorteia as contas (\"7 × 8\") e eles marcam o resultado.\n3. Quem completa uma linha explica em voz alta uma das contas usando grupos (\"7 grupos de 8\").\nVariação para quem já domina: cartela com contas, sorteio com resultados.",
    "mat-adicao": "Contas no quadriculado (20 min)\n1. Contas de adição com reagrupamento montadas em papel quadriculado, unidades e dezenas em cores diferentes.\n2. A cada conta, o aluno diz em voz alta o que acontece quando as unidades passam de 9.\n3. Termine com 3 contas de subtração com empréstimo, no mesmo formato.",
    "mat-problemas": "Problemas sem números (25 min)\n1. Leia um problema trocando os números por \"alguns\" (\"Ana tinha algumas figurinhas e ganhou mais algumas\").\n2. A turma decide só a operação, sem calcular, e justifica.\n3. Depois os números voltam e eles resolvem.\nIsso separa a interpretação do cálculo, que é onde a turma tropeça.",
    "por-leitura": "Leitura com pausa (25 min)\n1. Texto curto (meia página) lido em voz alta, com 3 pausas combinadas.\n2. Em cada pausa: \"o que aconteceu até aqui?\" e \"o que vai acontecer?\".\n3. No fim, cada aluno escreve em uma frase a ideia principal e compara com a do colega.",
    "por-ortografia": "Caderno das palavras que enganam (20 min)\n1. Ditado curto com 10 palavras do dia a dia com s, ss e ç.\n2. Cada aluno corrige com a lista no quadro e copia as que errou no caderno das palavras que enganam.\n3. Em duplas, criam uma frase engraçada com duas dessas palavras.",
    "geo-orientacao": "Caça ao tesouro no pátio (30 min)\n1. Marque Norte, Sul, Leste e Oeste no pátio com giz.\n2. Grupos recebem pistas (\"10 passos para o Leste, depois 5 para o Norte\").\n3. De volta à sala, desenham o caminho feito, com legenda.",
    "cie-seres-vivos": "Teia de quem come quem (25 min)\n1. Cartões com sol, capim, coelho, raposa, gavião, minhoca.\n2. Em grupos, montam a cadeia no chão ligando com barbante.\n3. Pergunta-chave: \"se o capim sumir, o que acontece com a raposa?\"",
}


def _lista(nomes: list[str], max_: int = 4) -> str:
    if len(nomes) <= max_:
        return ", ".join(nomes)
    return f"{', '.join(nomes[:max_])} e mais {len(nomes) - max_}"


def _ranking(r: RetratoTurma) -> list[dict]:
    com_peso = [{**h, "peso": len(h["alerta"]) * 2 + len(h["atencao"])} for h in r["habilidades"]]
    return sorted([h for h in com_peso if h["peso"] > 0], key=lambda h: h["peso"], reverse=True)


def _dificuldades(r: RetratoTurma) -> str:
    top = _ranking(r)[:3]
    if not top:
        return f"Nenhuma habilidade do {r['turma']} está em alerta ou atenção agora. Bom momento para avançar o conteúdo."
    linhas = []
    for i, h in enumerate(top):
        linha = f"{i + 1}. {h['nome']} ({h['disciplina']}): {len(h['alerta'])} em alerta, {len(h['atencao'])} em atenção"
        if h["alerta"]:
            linha += f" ({_lista(h['alerta'])})"
        linhas.append(linha)
    return "\n".join([
        f"Onde o {r['turma']} está com mais dificuldade agora:",
        "",
        *linhas,
        "",
        f"{top[0]['nome']} concentra o maior grupo. Se for escolher um foco para a semana, eu começaria por ela — posso sugerir uma atividade de reforço.",
    ])


def _atividade(r: RetratoTurma, habilidade_id: str | None = None) -> str:
    h = next((x for x in r["habilidades"] if x["id"] == habilidade_id), None)
    if h is None:
        rk = _ranking(r)
        h = rk[0] if rk else (r["habilidades"][0] if r["habilidades"] else None)
    if h is None:
        return "Não há habilidades ativas na turma para sugerir uma atividade."
    plano = _ATIVIDADES.get(
        h["id"],
        f"Atividade de reforço de {h['nome'].lower()} (25 min)\n1. Retome o conceito com um exemplo do cotidiano.\n2. Duplas resolvem 4 questões curtas, do mais fácil ao mais difícil.\n3. Cada dupla explica uma resposta para a turma.",
    )
    grupo = [*h["alerta"], *h["atencao"]]
    acompanhar = (
        f"Vale acompanhar de perto: {_lista(grupo, 6)} — coloque cada um em dupla com alguém que já domina a habilidade."
        if grupo
        else "Ninguém da turma está em alerta nessa habilidade; a atividade funciona como revisão."
    )
    return "\n".join([f"Sugestão para {h['nome']} ({h['disciplina']}):", "", plano, "", acompanhar])


def _alunos(r: RetratoTurma) -> str:
    contagem: dict[str, int] = {}
    for h in r["habilidades"]:
        for a in h["alerta"]:
            contagem[a] = contagem.get(a, 0) + 1
    ordem = sorted(contagem.items(), key=lambda kv: kv[1], reverse=True)
    if not ordem:
        return "Nenhum aluno com habilidade em alerta no momento."
    linhas = [f"• {nome}: {n} {'habilidade' if n == 1 else 'habilidades'} em alerta" for nome, n in ordem]
    extra = [f"", f"Sem atividade nos últimos 7 dias: {_lista(r['semAtividade'], 6)}"] if r["semAtividade"] else []
    return "\n".join([
        "Alunos que pedem mais atenção agora:",
        "",
        *linhas,
        *extra,
        "",
        "Os detalhes e as recomendações de cada um estão na página do aluno.",
    ])


def _evolucao(r: RetratoTurma) -> str:
    subiram = sorted([e for e in r["evolucao"] if e["variacao"] >= 5], key=lambda e: e["variacao"], reverse=True)
    cairam = sorted([e for e in r["evolucao"] if e["variacao"] <= -5], key=lambda e: e["variacao"])
    txt_subiram = ", ".join(f"{e['aluno']} (+{e['variacao']})" for e in subiram[:4])
    txt_cairam = ", ".join(f"{e['aluno']} ({e['variacao']})" for e in cairam[:4])
    return "\n".join([
        "Comparando o início do bimestre com as últimas atividades:",
        "",
        f"Avançaram: {txt_subiram}." if subiram else "Ninguém avançou de forma clara ainda.",
        f"Recuaram: {txt_cairam}." if cairam else "Ninguém recuou de forma relevante.",
        "",
        "Os números são a variação média de desempenho (0 a 100) nas habilidades ativas.",
    ])


def _geral(r: RetratoTurma) -> str:
    rk = _ranking(r)
    top = rk[0] if rk else None
    em_alerta = len({a for h in r["habilidades"] for a in h["alerta"]})
    return "\n".join([
        f"Resumo do {r['turma']}: {em_alerta} {'aluno tem' if em_alerta == 1 else 'alunos têm'} ao menos uma habilidade em alerta.",
        f"O ponto mais sensível é {top['nome']} ({top['disciplina']})." if top else "Nenhuma habilidade concentra dificuldades.",
        "",
        "Posso ajudar com perguntas como:",
        "• Onde a turma está com mais dificuldade?",
        "• Me dá uma atividade de reforço de frações para amanhã",
        "• Quem precisa de mais atenção?",
        "• Quem evoluiu neste bimestre?",
    ])


def responder_chat(pergunta: str, r: RetratoTurma) -> str:
    p = _normalizar(pergunta)
    tema = next((t for regex, t in _TEMAS if re.search(regex, p)), None)
    if re.search(r"atividade|reforco|exercicio|plano|aula|amanha|dinamica|jogo|sugest", p):
        return _atividade(r, tema)
    if re.search(r"evolu|melhor|progress|avanc|cresce|recu|pior(ou|aram)", p):
        return _evolucao(r)
    if re.search(r"quem|quais alunos|nomes|grupo|alunos", p):
        return _alunos(r)
    if re.search(r"dificuldade|atencao|alerta|onde|pior|fraco|errando|semana", p):
        return _dificuldades(r)
    if tema:
        return _atividade(r, tema)
    return _geral(r)
