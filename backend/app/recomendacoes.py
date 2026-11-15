from __future__ import annotations

from . import llm
from .dados import TEXTOS

_cache: dict[tuple[str, str], str] = {}

_POR_DISCIPLINA = {
    "Matemática": (
        "Leve “{nome}” para o dia a dia: contas na hora das compras, dividir uma receita ou medir objetos da casa. Peça que o estudante explique em voz alta como chegou ao resultado e comece por exemplos fáceis antes de aumentar o desafio."
    ),
    "Português": (
        "Leiam juntos textos curtos de que o estudante goste, como gibis, receitas ou notícias, e conversem sobre eles pensando em “{nome}”. Peça que ele mostre no texto onde encontrou cada resposta."
    ),
    "Ciências": (
        "Observem juntos situações do cotidiano ligadas a “{nome}”: plantas, água, alimentos e objetos da casa. Façam perguntas como “por que será?” e registrem as descobertas num caderno, com desenhos."
    ),
    "Geografia": (
        "Explore “{nome}” a partir do lugar onde o estudante vive: o caminho até a escola, o bairro, um mapa no celular. Peça que ele descreva ou desenhe o que vê, usando referências como perto, longe, direita e esquerda."
    ),
    "História": (
        "Relacione “{nome}” à história da família e da cidade: fotos antigas, conversas com os avós, objetos de outras épocas. Pergunte o que mudou e o que continua igual, e deixe o estudante contar com as próprias palavras."
    ),
    "Inglês": (
        "Pratique “{nome}” em momentos curtos e divertidos: músicas, desenhos com áudio em inglês, nomes de objetos da casa. Repetir as mesmas palavras e frases durante a semana dá segurança para usar o idioma."
    ),
}
_PADRAO = "Reserve alguns minutos para praticar “{nome}” com atividades curtas do dia a dia, elogiando o esforço. Peça que o estudante explique o que entendeu com as próprias palavras."
_FECHO = {
    "alerta": " Como a dificuldade ainda é grande, vale praticar um pouco todos os dias, com calma.",
    "atencao": " Uma prática curta algumas vezes por semana já ajuda.",
}


def texto_padrao(habilidade_nome: str, disciplina: str, status: str) -> str:
    base = _POR_DISCIPLINA.get(disciplina, _PADRAO).format(nome=habilidade_nome)
    return base + _FECHO.get(status, "")


_SISTEMA = (
    "Você é um apoio pedagógico do ensino fundamental. Escreva uma recomendação "
    "curta (2 a 4 frases), prática e acolhedora, para o responsável ou professor ajudar a criança "
    "numa habilidade específica. Linguagem simples, sem jargão, em texto corrido: sem listas, "
    "títulos ou asteriscos. "
    "Sugira uma atividade concreta do dia a dia. Não invente dados do aluno além do que for informado."
)


def texto_para(habilidade_id: str, habilidade_nome: str, disciplina: str, status: str) -> str:
    chave = (habilidade_id, status)
    if chave in _cache:
        return _cache[chave]

    texto = None
    if llm.disponivel():
        nivel = "dificuldade significativa (alerta)" if status == "alerta" else "sinais de atenção"
        prompt = (
            f"Habilidade: {habilidade_nome} ({disciplina}). "
            f"A criança está com {nivel} nesta habilidade. "
            f"Escreva a recomendação para quem acompanha a criança."
        )
        texto = llm.gerar(_SISTEMA, [{"role": "user", "content": prompt}], max_tokens=1200)

    if not texto:
        texto = TEXTOS.get(habilidade_id)
    if not texto:
        return texto_padrao(habilidade_nome, disciplina, status)

    _cache[chave] = texto
    return texto
