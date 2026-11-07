"""Geração de exercícios por habilidade (passo 5).

O professor pede um exercício de reforço para uma habilidade num dado nível; o LLM gera
uma questão de múltipla escolha no MESMO formato do banco curado (enunciado + 4 opções +
índice da resposta certa), mais uma explicação curta para o professor.

Conteúdo vai para criança, então validamos tudo: tem que vir JSON válido, com exatamente
4 opções distintas e um índice de resposta dentro do intervalo. Se a IA falhar, devolver
algo inválido, ou não estiver configurada, caímos numa questão do banco curado (dados.py) —
a demo nunca fica sem exercício.
"""
from __future__ import annotations

import json
import os
import random
import re

from . import llm
from .dados import BANCO, HAB_POR_ID

# Habilidades do catálogo antigo (sem ano no catálogo) são do 4º ano.
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
    "Em questão de ortografia ('qual está escrita corretamente'), as opções erradas têm de ser "
    "grafias que NÃO existem; nunca use outra palavra real como distrator (ex.: 'coro' para "
    "'carro', 'fera' para 'feira'), senão haverá duas opções corretas. "
    "A questão tem que se sustentar só com texto: nunca peça para olhar uma imagem, figura, mapa "
    "ou gráfico que não esteja escrito no enunciado. Se a habilidade for de leitura ou "
    "interpretação, coloque no próprio enunciado um texto curto (2 a 5 frases, entre aspas) e "
    "depois a pergunta sobre ele. O enunciado SEMPRE termina com a pergunta (com ponto de "
    "interrogação) ou com um comando terminado em dois-pontos — nunca só com o texto."
    )


_RE_CITACAO = re.compile(r'"[^"]*"|“[^”]*”')


def _tem_pergunta(enunciado: str) -> bool:
    """O enunciado precisa pedir algo FORA do texto citado (a IA às vezes manda só o texto)."""
    s = enunciado.strip()
    fora = _RE_CITACAO.sub(" ", s).strip()
    if s.endswith(('"', "”")):
        # Termina no texto citado: só vale se o comando antes pede algo ("Complete: ..."),
        # não se é só "Leia o texto: ..." (aí falta a pergunta).
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
    """Pega o primeiro objeto JSON do texto, tolerando cercas ```json e texto em volta."""
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
    """Converte a opção em número quando ela é número, fração, decimal ou porcentagem.
    Devolve None quando não é numérica (ex.: "a metade", "cat"). Serve para pegar duas
    opções de mesmo valor escritas de formas diferentes (2/4 e 1/2, 0,5 e 1/2, 50% e 1/2)."""
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
    """True se duas opções tiverem o MESMO valor numérico (ex.: 2/4 e 1/2)."""
    numericas = [v for v in (_valor_numerico(o) for o in opcoes) if v is not None]
    for i in range(len(numericas)):
        for j in range(i + 1, len(numericas)):
            if abs(numericas[i] - numericas[j]) < 1e-9:
                return True
    return False


def _valido(dados: dict) -> bool:
    """Checa o formato antes de deixar passar para a criança."""
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
    if len({o.strip().lower() for o in opcoes}) != 4:  # todas distintas (texto)
        return False
    if _tem_opcoes_equivalentes(opcoes):  # distintas também em valor (2/4 vs 1/2)
        return False
    if not isinstance(indice, int) or isinstance(indice, bool) or not 0 <= indice <= 3:
        return False
    return True


def _do_banco(habilidade_id: str, nivel: str) -> dict | None:
    """Fallback: uma questão do banco curado para a habilidade (preferindo o nível pedido)."""
    candidatas = [p for p in BANCO if p["habilidadeId"] == habilidade_id]
    if not candidatas:
        return None
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
    """Segunda opinião independente: o revisor resolve sem gabarito e audita o conteúdo.
    Só aprova se ele chegar na MESMA resposta e não apontar ambiguidade nem erro."""
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


_AVALIACAO = os.path.join(os.path.dirname(__file__), "avaliacao_llm.json")


def avaliacao() -> dict | None:
    """Resultado de ml/avaliar_llm.py (revisor do próprio modelo x revisor de outro modelo)."""
    if not os.path.exists(_AVALIACAO):
        return None
    with open(_AVALIACAO, encoding="utf-8") as f:
        return json.load(f)


def gerar_exercicio(habilidade_id: str, nivel: str = "medio", evitar: list[str] | None = None,
                    usar_banco: bool = True, revisar: bool = False) -> dict:
    """Gera (ou recupera do banco) um exercício para a habilidade/nível.

    Devolve sempre um dict completo com `origem` = "ia" | "banco" para o front saber
    se é gerado ou curado. `evitar` lista enunciados já existentes (para não repetir);
    com `usar_banco=False` não cai no banco curado (a geração em lote usa isso) e levanta
    ValueError se a IA não entregar uma questão válida. `revisar=True` só aceita a questão
    se o revisor independente (_revisar) concordar — é o que vale para o que vai ao aluno.
    """
    hab = _habilidade(habilidade_id)
    if hab is None:
        raise ValueError(f"Habilidade desconhecida: {habilidade_id}")
    if nivel not in NIVEIS:
        nivel = "medio"

    gerado = None
    if llm.disponivel():
        prompt = _prompt(hab, nivel, evitar or [])
        sistema = _sistema(hab.get("ano") or _ANO_LEGADO)
        for _ in range(3):  # re-tenta: descartamos saídas inválidas (ex.: opções equivalentes)
            bruto = llm.gerar(sistema, [{"role": "user", "content": prompt}], max_tokens=1200)
            dados = _extrair_json(bruto or "")
            if dados and _valido(dados):
                if revisar and not _revisar(hab, dados):
                    continue  # revisor discordou ou viu ambiguidade/erro: descarta e tenta de novo
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
    if gerado is None:  # fallback: banco curado
        base = _do_banco(habilidade_id, nivel)
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
