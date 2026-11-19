from __future__ import annotations

import json
import os
import random
import re

from . import llm
from .dados import BANCO, HAB_POR_ID

_ANO_LEGADO = 4

NIVEIS = ("facil", "medio", "dificil")

_RE_FRACAO = re.compile(r"^-?\d+/\d+$")

def _sistema(ano: int) -> str:
    etapa = "anos iniciais" if ano <= 5 else "anos finais"
    return (
    f"Você cria exercícios para estudantes do {ano}º ano do ensino fundamental ({etapa}, cerca de {ano + 5} anos). "
    "Gere UMA questão de múltipla escolha em português do Brasil, adequada à idade, clara e sem pegadinha. "
    "Responda SOMENTE com um JSON válido, sem markdown, sem comentários, exatamente neste formato:\n"
    '{"enunciado": "...", "opcoes": ["...", "...", "...", "..."], "indiceCorreta": 0, '
    '"explicacao": "por que a resposta certa está certa, em uma frase para o professor"}\n'
    "Regras: exatamente 4 opções, todas diferentes entre si; APENAS UMA pode estar correta; "
    "as outras três têm que estar de fato erradas. Nunca inclua duas opções que valham a mesma "
    "coisa ou sejam equivalentes (por exemplo, 2/4 e 1/2 são o mesmo valor, então não podem "
    "aparecer juntas; 0,5 e 1/2 também). Antes de responder, confira que só existe UMA resposta "
    "correta entre as quatro. indiceCorreta é a posição (0 a 3) da opção certa; não numere nem "
    "rotule as opções (nada de 'a)', '1.'). "
    "As quatro opções devem ter tamanho e nível de detalhe parecidos: a correta NÃO pode ser a "
    "mais longa nem a mais completa (o aluno não pode acertar só pelo tamanho). "
    "Em questão de ortografia ('qual está escrita corretamente'), as opções erradas têm de ser "
    "grafias que NÃO existem; nunca use outra palavra real como distrator (ex.: 'coro' para "
    "'carro', 'fera' para 'feira'), senão haverá duas opções corretas. "
    "A questão tem que se sustentar só com texto: nunca peça para olhar uma imagem, figura, mapa "
    "ou gráfico que não esteja escrito no enunciado. Se a habilidade for de leitura ou "
    "interpretação, coloque no próprio enunciado um texto curto (2 a 5 frases, entre aspas) e "
    "depois a pergunta sobre ele. O enunciado SEMPRE termina com a pergunta (com ponto de "
    "interrogação) ou com um comando terminado em dois-pontos — nunca só com o texto, nem com reticências."
    )


_RE_CITACAO = re.compile(r'"[^"]*"|“[^”]*”')


def _tem_pergunta(enunciado: str) -> bool:
    s = enunciado.strip()
    fora = _RE_CITACAO.sub(" ", s).strip()
    if s.endswith(('"', "”")):
        return fora.endswith(":") and not fora.lower().startswith("leia")
    return "?" in fora or fora.endswith((":", "…", "..."))

_NIVEL_DESC = {
    "facil": "nível fácil (bem introdutório)",
    "medio": "nível médio",
    "dificil": "nível difícil (desafio, ainda adequado ao ano)",
}


def _habilidade(habilidade_id: str) -> dict | None:
    return HAB_POR_ID.get(habilidade_id)


def _extrair_json(texto: str) -> dict | None:
    if not texto:
        return None
    inicio = texto.find("{")
    fim = texto.rfind("}")
    if inicio == -1 or fim == -1 or fim < inicio:
        return None
    try:
        return json.loads(texto[inicio : fim + 1])
    except (json.JSONDecodeError, ValueError):
        return None


def _valor_numerico(opcao: str) -> float | None:
    s = opcao.strip().lower().replace("r$", "").replace("$", "").replace(" ", "")
    if not s:
        return None
    porcento = s.endswith("%")
    if porcento:
        s = s[:-1]
    if _RE_FRACAO.match(s):
        num, den = s.split("/")
        denominador = int(den)
        if denominador == 0:
            return None
        valor = int(num) / denominador
    else:
        try:
            valor = float(s.replace(",", "."))
        except ValueError:
            return None
    return valor / 100 if porcento else valor


def _tem_opcoes_equivalentes(opcoes: list[str]) -> bool:
    numericas = [v for v in (_valor_numerico(o) for o in opcoes) if v is not None]
    for i in range(len(numericas)):
        for j in range(i + 1, len(numericas)):
            if abs(numericas[i] - numericas[j]) < 1e-9:
                return True
    return False


def _entrega_pelo_tamanho(opcoes: list[str], indice: int) -> bool:
    tamanhos = sorted((len(o.strip()) for o in opcoes), reverse=True)
    certa = len(opcoes[indice].strip())
    return certa == tamanhos[0] and certa >= 1.3 * tamanhos[1] and certa - tamanhos[1] >= 6


def _valido(dados: dict) -> bool:
    if not isinstance(dados, dict):
        return False
    enunciado = dados.get("enunciado")
    opcoes = dados.get("opcoes")
    indice = dados.get("indiceCorreta")
    if not isinstance(enunciado, str) or not enunciado.strip():
        return False
    if not _tem_pergunta(enunciado):
        return False
    if not isinstance(opcoes, list) or len(opcoes) != 4:
        return False
    if any(not isinstance(o, str) or not o.strip() for o in opcoes):
        return False
    if len({o.strip().lower() for o in opcoes}) != 4:
        return False
    if _tem_opcoes_equivalentes(opcoes):
        return False
    if not isinstance(indice, int) or isinstance(indice, bool) or not 0 <= indice <= 3:
        return False
    if _entrega_pelo_tamanho(opcoes, indice):
        return False
    return True


def _do_banco(habilidade_id: str, nivel: str, evitar: list[str] | None = None) -> dict | None:
    candidatas = [p for p in BANCO if p["habilidadeId"] == habilidade_id]
    if not candidatas:
        return None
    vistas = set(evitar or [])
    candidatas = [p for p in candidatas if p["enunciado"] not in vistas] or candidatas
    no_nivel = [p for p in candidatas if p["nivel"] == nivel]
    p = random.choice(no_nivel or candidatas)
    return {
        "enunciado": p["enunciado"],
        "opcoes": list(p["opcoes"]),
        "indiceCorreta": p["certa"],
        "explicacao": p.get("explicacao") or "",
        "apoio": p.get("apoio"),
    }


def _prompt(hab: dict, nivel: str, evitar: list[str]) -> str:
    if hab.get("codigoBncc"):
        base = (
            f"Habilidade da BNCC {hab['codigoBncc']} — {hab['nome']} ({hab['disciplina']}). "
            f"Texto oficial: {hab['descricao']} "
        )
    else:
        base = f"Habilidade: {hab['nome']} ({hab['disciplina']}). Descrição: {hab['descricao']} "
    if hab.get("dica"):
        base += f"Atenção ao conteúdo: {hab['dica']} "
    texto = base + f"Gere uma questão de {_NIVEL_DESC[nivel]} sobre essa habilidade."
    if evitar:
        lista = "\n".join(f"- {e}" for e in evitar[-12:])
        texto += f"\nNão repita nem parafraseie estas questões que já existem:\n{lista}"
    return texto


_SISTEMA_REVISOR = (
    "Você revisa questões de múltipla escolha para estudantes do ensino fundamental, com rigor de "
    "professor especialista. Resolva a questão você mesmo, SEM gabarito, e confira o conteúdo "
    "(regras de gramática, ortografia, acentuação, contas, fatos). Desconfie da premissa: confira, "
    "um por um, se cada exemplo citado no enunciado e nas opções pertence de fato à categoria que "
    "a questão afirma (ex.: se a questão fala em paroxítonas, separe as sílabas e ache a tônica de "
    "cada palavra; se fala em ditongo, sufixo, concordância, verifique cada caso). Se algum "
    "exemplo não se encaixa na regra pedida, conteudoCorreto é false. Responda SOMENTE com JSON, "
    "escrevendo a análise ANTES do veredito:\n"
    '{"analise": "verificação item a item", "resposta": <índice 0-3 da opção correta>, '
    '"unicaCorreta": true|false, "conteudoCorreto": true|false, "avaliaHabilidade": true|false, '
    '"problema": "..."}\n'
    "unicaCorreta = existe exatamente UMA opção defensável (nenhuma outra pode ser aceita por um "
    "professor razoável). conteudoCorreto = enunciado e opções não têm erro de conteúdo nem "
    "exemplo que contradiga a regra pedida. avaliaHabilidade = a questão de fato exercita a "
    "habilidade informada. problema = vazio se estiver tudo certo."
)


def _revisar(hab: dict, q: dict) -> bool:
    opcoes = "\n".join(f"{i}. {o}" for i, o in enumerate(q["opcoes"]))
    prompt = (
        f"Habilidade ({hab.get('codigoBncc') or hab['nome']}): {hab['descricao']}\n"
        f"Ano: {hab.get('ano') or _ANO_LEGADO}º ano do ensino fundamental.\n"
        + (f"Nota do especialista sobre a habilidade: {hab['dica']}\n" if hab.get("dica") else "")
        + f"\nQuestão: {q['enunciado']}\n{opcoes}"
    )
    bruto = llm.gerar(_SISTEMA_REVISOR, [{"role": "user", "content": prompt}], temperatura=0.0,
                      max_tokens=4000, papel="revisor")
    r = _extrair_json(bruto or "")
    if not isinstance(r, dict):
        return False
    return (
        r.get("resposta") == q["indiceCorreta"]
        and r.get("unicaCorreta") is True
        and r.get("conteudoCorreto") is True
        and r.get("avaliaHabilidade") is True
    )


def _contexto_habilidade(hab: dict) -> str:
    return (
        f"Habilidade ({hab.get('codigoBncc') or hab['nome']}): {hab['descricao']}\n"
        f"Ano: {hab.get('ano') or _ANO_LEGADO}º ano do ensino fundamental.\n"
        + (f"Nota do especialista sobre a habilidade: {hab['dica']}\n" if hab.get("dica") else "")
    )


def _veredito(r: dict, indice: int) -> dict:
    aprovada = (
        r.get("resposta") == indice
        and r.get("unicaCorreta") is True
        and r.get("conteudoCorreto") is True
        and r.get("avaliaHabilidade") is True
    )
    problema = str(r.get("problema") or "").strip()
    if not aprovada and not problema:
        problema = "A IA revisora chegou a outra resposta." if r.get("resposta") != indice else "A IA revisora apontou um problema."
    resposta = r.get("resposta")
    return {"aprovada": aprovada, "problema": "" if aprovada else problema[:300],
            "respostaIa": resposta if isinstance(resposta, int) and not isinstance(resposta, bool) else None}


def revisar_uma(habilidade_id: str, q: dict) -> dict | None:
    hab = _habilidade(habilidade_id)
    if hab is None or not llm.disponivel():
        return None
    opcoes = "\n".join(f"{i}. {o}" for i, o in enumerate(q["opcoes"]))
    prompt = _contexto_habilidade(hab) + f"\nQuestão: {q['enunciado']}\n{opcoes}"
    bruto = llm.gerar(_SISTEMA_REVISOR, [{"role": "user", "content": prompt}], temperatura=0.0, max_tokens=4000, papel="revisor")
    r = _extrair_json(bruto or "")
    return _veredito(r, q["indiceCorreta"]) if isinstance(r, dict) else None


_TIPOS_LOTE = {
    "escolha": "Todas as questões são de múltipla escolha.",
    "lacuna": "Todas as questões são de completar a frase.",
    "misto": "Misture os dois tipos: cerca de metade de cada.",
}


def _sistema_lote(ano: int) -> str:
    etapa = "anos iniciais" if ano <= 5 else "anos finais"
    return (
        f"Você ajuda uma professora do {ano}º ano do ensino fundamental ({etapa}, cerca de {ano + 5} anos) a montar "
        "a trilha de exercícios da semana. Ela conta o que trabalhou em sala; crie questões sobre ESSE conteúdo, "
        "usando o contexto que ela descreveu, para a habilidade da BNCC informada. Português do Brasil, linguagem "
        "adequada à idade, sem pegadinha. Responda SOMENTE com JSON válido, sem markdown, no formato "
        '{"perguntas": [ ... ]}, em que cada item é de um destes tipos:\n'
        '- múltipla escolha: {"tipo": "escolha", "enunciado": "...", "opcoes": ["...", "...", "...", "..."], '
        '"indiceCorreta": 0, "explicacao": "..."}\n'
        '- completar a frase: {"tipo": "lacuna", "instrucao": "Complete a frase", "frase": "Frase com ___ no lugar da '
        'resposta.", "opcoes": ["...", "...", "...", "..."], "indiceCorreta": 0, "explicacao": "..."}\n'
        "Regras para todas: exatamente 4 opções, todas diferentes; APENAS UMA correta e as outras de fato erradas; "
        "nada de opções equivalentes (1/2 e 2/4, 0,5 e 1/2); a correta NÃO pode ser a mais longa nem a mais completa; "
        "varie a posição da correta (indiceCorreta de 0 a 3); não numere nem rotule as opções; nunca peça para olhar "
        "imagem, mapa ou gráfico que não esteja escrito. Na múltipla escolha, o enunciado termina com a pergunta "
        "(ponto de interrogação) ou com dois-pontos. No completar a frase, a frase tem exatamente uma lacuna ___ e "
        "cada opção é uma palavra ou expressão curta que encaixa na lacuna; só uma deixa a frase correta. "
        "explicacao: por que a certa está certa, em uma frase, para a professora. Não repita questões entre si."
    )


def _rascunho(item: dict, habilidade_id: str, nivel: str) -> dict | None:
    if not isinstance(item, dict):
        return None
    opcoes = item.get("opcoes")
    indice = item.get("indiceCorreta")
    if not isinstance(opcoes, list) or len(opcoes) != 4 or any(not isinstance(o, str) or not o.strip() for o in opcoes):
        return None
    opcoes = [o.strip() for o in opcoes]
    if len({o.lower() for o in opcoes}) != 4 or _tem_opcoes_equivalentes(opcoes):
        return None
    if not isinstance(indice, int) or isinstance(indice, bool) or not 0 <= indice <= 3 or _entrega_pelo_tamanho(opcoes, indice):
        return None
    explicacao = str(item.get("explicacao") or "").strip()[:400]
    base = {"habilidadeId": habilidade_id, "nivel": nivel, "opcoes": opcoes, "certa": indice, "explicacao": explicacao}
    if item.get("tipo") == "lacuna":
        frase = str(item.get("frase") or "").strip().replace('"', "'")
        if len(re.findall(r"_{2,}", frase)) != 1:
            return None
        instrucao = str(item.get("instrucao") or "").strip().replace('"', "'").rstrip(":. ") or None
        return {**base, "tipo": "lacuna", "instrucao": instrucao, "frase": frase,
                "enunciado": f'{instrucao or "Complete a frase"}: "{frase}"'}
    enunciado = str(item.get("enunciado") or "").strip()
    if not enunciado or not _tem_pergunta(enunciado):
        return None
    return {**base, "tipo": "escolha", "instrucao": None, "frase": None, "enunciado": enunciado}


_SISTEMA_REVISOR_LOTE = (
    _SISTEMA_REVISOR.replace("Responda SOMENTE com JSON", "Você recebe VÁRIAS questões numeradas e revisa cada uma. Responda SOMENTE com JSON")
    .replace('{"analise"', '{"revisoes": [{"numero": <número da questão>, "analise"')
    .replace('"problema": "..."}\n', '"problema": "..."}, ...]}\n')
)


def _revisar_lote(hab: dict, rascunhos: list[dict]) -> list[dict | None]:
    blocos = []
    for n, q in enumerate(rascunhos, start=1):
        opcoes = "\n".join(f"{i}. {o}" for i, o in enumerate(q["opcoes"]))
        blocos.append(f"Questão {n}: {q['enunciado']}\n{opcoes}")
    prompt = _contexto_habilidade(hab) + "\n" + "\n\n".join(blocos)
    bruto = llm.gerar(_SISTEMA_REVISOR_LOTE, [{"role": "user", "content": prompt}], temperatura=0.0,
                      max_tokens=min(12000, 2500 + 1500 * len(rascunhos)), papel="revisor")
    dados = _extrair_json(bruto or "")
    revisoes = dados.get("revisoes") if isinstance(dados, dict) else None
    if not isinstance(revisoes, list):
        return [None] * len(rascunhos)
    por_numero = {r.get("numero"): r for r in revisoes if isinstance(r, dict)}
    return [_veredito(por_numero[n], q["certa"]) if n in por_numero else None for n, q in enumerate(rascunhos, start=1)]


def gerar_lote(habilidade_id: str, descricao: str, quantidade: int, nivel: str, tipo: str) -> list[dict] | None:
    hab = _habilidade(habilidade_id)
    if hab is None or not llm.disponivel():
        return None
    prompt = (
        _contexto_habilidade(hab)
        + f"\nO que a professora trabalhou na aula: {descricao}\n"
        + f"Crie {quantidade} questões de {_NIVEL_DESC.get(nivel, 'nível médio')}. {_TIPOS_LOTE.get(tipo, _TIPOS_LOTE['misto'])}"
    )
    bruto = llm.gerar(_sistema_lote(hab.get("ano") or _ANO_LEGADO), [{"role": "user", "content": prompt}],
                      temperatura=0.5, max_tokens=min(9000, 2500 + 900 * quantidade))
    dados = _extrair_json(bruto or "")
    itens = dados.get("perguntas") if isinstance(dados, dict) else None
    if not isinstance(itens, list):
        return None
    rascunhos = [r for r in (_rascunho(i, habilidade_id, nivel) for i in itens[:quantidade]) if r]
    if not rascunhos:
        return None
    for r, revisao in zip(rascunhos, _revisar_lote(hab, rascunhos)):
        r["revisao"] = revisao
    return rascunhos


_AVALIACAO = os.path.join(os.path.dirname(__file__), "avaliacao_llm.json")


def avaliacao() -> dict | None:
    if not os.path.exists(_AVALIACAO):
        return None
    with open(_AVALIACAO, encoding="utf-8") as f:
        return json.load(f)


def gerar_exercicio(habilidade_id: str, nivel: str = "medio", evitar: list[str] | None = None,
                    usar_banco: bool = True, revisar: bool = False) -> dict:
    hab = _habilidade(habilidade_id)
    if hab is None:
        raise ValueError(f"Habilidade desconhecida: {habilidade_id}")
    if nivel not in NIVEIS:
        nivel = "medio"

    gerado = None
    if llm.disponivel():
        prompt = _prompt(hab, nivel, evitar or [])
        sistema = _sistema(hab.get("ano") or _ANO_LEGADO)
        for _ in range(3):
            bruto = llm.gerar(sistema, [{"role": "user", "content": prompt}], max_tokens=1200)
            dados = _extrair_json(bruto or "")
            if dados and _valido(dados):
                if revisar and not _revisar(hab, dados):
                    continue
                gerado = {
                    "enunciado": dados["enunciado"].strip(),
                    "opcoes": [o.strip() for o in dados["opcoes"]],
                    "indiceCorreta": dados["indiceCorreta"],
                    "explicacao": str(dados.get("explicacao", "")).strip(),
                    "apoio": None,
                    "origem": "ia",
                }
                break

    if gerado is None and not usar_banco:
        raise ValueError(f"A IA não gerou questão válida para {habilidade_id} ({nivel})")
    if gerado is None:
        base = _do_banco(habilidade_id, nivel, evitar)
        if base is None:
            raise ValueError(f"Sem exercício disponível para {habilidade_id}")
        gerado = {**base, "origem": "banco"}

    return {
        "habilidadeId": habilidade_id,
        "habilidade": hab["nome"],
        "disciplina": hab["disciplina"],
        "codigoBncc": hab.get("codigoBncc"),
        "nivel": nivel,
        **gerado,
    }
