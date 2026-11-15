from __future__ import annotations

import json
import os

from . import catalogo

TURMA = {"id": "t1", "nome": "4º ano B", "codigo": "SABIA4", "ano": 4}
ANOS = [4, 5, 6, 7, 8, 9]

DISCIPLINAS = [
    {"id": "por", "nome": "Português"},
    {"id": "mat", "nome": "Matemática"},
    {"id": "geo", "nome": "Geografia"},
    {"id": "cie", "nome": "Ciências"},
    {"id": "his", "nome": "História"},
    {"id": "ing", "nome": "Inglês"},
]


def nome_disciplina(id_: str) -> str | None:
    for d in DISCIPLINAS:
        if d["id"] == id_:
            return d["nome"]
    return None


def _legado(id_: str, nome: str, disciplina: str, descricao: str) -> dict:
    return {"id": id_, "codigoBncc": None, "nome": nome, "disciplina": disciplina, "descricao": descricao,
            "ano": None, "unidade": None, "avaliavel": True, "dica": None}


_LEGADO = {
    "mat": [
        _legado("mat-adicao", "Adição e subtração", "Matemática", "Cálculos com números até 1.000, com e sem reagrupamento."),
        _legado("mat-mult", "Multiplicação", "Matemática", "Tabuada e multiplicação por um algarismo."),
        _legado("mat-fracoes", "Frações simples", "Matemática", "Metade, terço e quarto em situações do dia a dia."),
        _legado("mat-problemas", "Resolução de problemas", "Matemática", "Interpretar o enunciado e escolher a operação."),
    ],
    "geo": [
        _legado("geo-orientacao", "Orientação e mapas", "Geografia", "Pontos cardeais, legenda e escala em mapas simples."),
        _legado("geo-paisagem", "Paisagem e lugar", "Geografia", "Elementos naturais e construídos; campo e cidade."),
    ],
    "cie": [
        _legado("cie-seres-vivos", "Seres vivos", "Ciências", "Características de plantas e animais e cadeias alimentares."),
        _legado("cie-materia", "Água e materiais", "Ciências", "Estados físicos da água e propriedades dos materiais."),
    ],
    "ing": [
        _legado("ing-vocabulario", "Vocabulário", "Inglês", "Cores, números, animais e alimentos."),
        _legado("ing-frases", "Frases do dia a dia", "Inglês", "Cumprimentos e perguntas simples sobre si mesmo."),
    ],
}

ORDEM_MATRIZ = ["mat", "por", "geo", "cie", "his", "ing"]

_CATALOGOS: dict[int, list[dict]] = {}


def catalogo_do_ano(ano: int) -> list[dict]:
    if ano not in _CATALOGOS:
        saida: list[dict] = []
        for did in ORDEM_MATRIZ:
            if catalogo.tem_caminho(ano, did):
                saida.extend(catalogo.caminho(ano, did, nome_disciplina(did)))
            elif ano == 4:
                saida.extend(_LEGADO.get(did, []))
        _CATALOGOS[ano] = saida
    return _CATALOGOS[ano]


def habilidades_do_ano(ano: int) -> list[dict]:
    return [h for h in catalogo_do_ano(ano) if h["avaliavel"]]


HAB_POR_ID: dict[str, dict] = {h["id"]: h for ano in ANOS for h in catalogo_do_ano(ano)}

CATALOGO = catalogo_do_ano(4)
HABILIDADES = habilidades_do_ano(4)


def ordem_caminho(ano: int, disciplina_id: str) -> list[str] | None:
    if not catalogo.tem_caminho(ano, disciplina_id):
        return None
    nome = nome_disciplina(disciplina_id)
    return [h["id"] for h in habilidades_do_ano(ano) if h["disciplina"] == nome and h["id"] in COM_PERGUNTAS]


_ORDEM_LEGADA = ["mat-adicao", "mat-mult", "mat-fracoes", "mat-problemas", None, None, None,
                 "geo-orientacao", "geo-paisagem", "cie-seres-vivos", "cie-materia", "ing-vocabulario", "ing-frases"]
REFERENCIA_DEMO = "2026-10-13"
INICIO_HISTORICO_DEMO = "2026-08-24"

ALUNOS = [
    {"id": "a1", "nome": "Ana Clara Souza", "ultima": "2026-10-13", "status": "ooao" + "oao" + "oa" + "oo" + "oo",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF35LP04": "a", "EF04LP01": "a"}},
    {"id": "a2", "nome": "Bruno Ferreira", "ultima": "2026-10-13", "status": "oaxx" + "ooo" + "oo" + "ao" + "ao",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF35LP04": "o", "EF35LP05": "o", "EF04LP01": "o"}},
    {"id": "a3", "nome": "Caio Nascimento", "ultima": "2026-10-10", "status": "oooo" + "ooo" + "oo" + "oo" + "oo",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF35LP04": "o", "EF35LP05": "o", "EF35LP06": "o", "EF04LP01": "o"}},
    {"id": "a4", "nome": "Daniela Rocha", "ultima": "2026-10-12", "status": "oooa" + "xao" + "ao" + "oo" + "ox",
     "por": {"EF15LP03": "x", "EF35LP03": "a", "EF04LP01": "a"}},
    {"id": "a5", "nome": "Enzo Martins", "ultima": "2026-10-13", "status": "aaoa" + "ooo" + "oo" + "xo" + "oo",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF35LP04": "o", "EF04LP01": "o"}},
    {"id": "a6", "nome": "Fernanda Lima", "ultima": "2026-10-09", "status": "oooo" + "oao" + "oo" + "oa" + "oo",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF35LP04": "o", "EF04LP01": "a"}},
    {"id": "a7", "nome": "Gabriel Alves", "ultima": None, "status": "oooo" + "ooo" + "oo" + "oo" + "oo",
     "por": {}},
    {"id": "a8", "nome": "Helena Costa", "ultima": "2026-10-11", "status": "xaox" + "oao" + "ao" + "oa" + "oo",
     "por": {"EF15LP03": "o", "EF35LP03": "a", "EF04LP01": "a"}},
    {"id": "a9", "nome": "Isadora Pereira", "ultima": "2026-10-13", "status": "oooo" + "oao" + "oo" + "oo" + "oa",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF35LP04": "a", "EF04LP01": "a"}},
    {"id": "a10", "nome": "João Pedro Dias", "ultima": "2026-10-12", "status": "ooao" + "oxo" + "xo" + "oo" + "oo",
     "por": {"EF15LP03": "o", "EF35LP03": "o", "EF04LP01": "x"}},
]

STATUS = {"o": "ok", "a": "atencao", "x": "alerta"}

_IDS = {h["id"] for h in HABILIDADES}


def _status_inicial(a: dict) -> dict[str, str]:
    saida = {hid: STATUS[c] for hid, c in zip(_ORDEM_LEGADA, a["status"]) if hid and hid in _IDS}
    saida.update({hid: STATUS[c] for hid, c in a["por"].items() if hid in _IDS})
    return saida


STATUS_INICIAL = {a["id"]: _status_inicial(a) for a in ALUNOS}

PINS_INICIAIS = {
    "a1": "1234", "a2": "2580", "a3": "3141", "a4": "4072", "a5": "5319",
    "a6": "6248", "a7": "7105", "a8": "8463", "a9": "9026", "a10": "1357",
}

TEXTOS = {
    "mat-adicao": "Nas últimas atividades, os erros aparecem quando a conta exige reagrupamento (\"vai um\"). Vale montar contas no papel quadriculado, separando dezenas e unidades por cor, e pedir que a criança explique em voz alta o que acontece quando a soma das unidades passa de 9. Dez minutos, três vezes por semana, costumam ser suficientes.",
    "mat-mult": "A tabuada do 6 ao 9 ainda está sendo resolvida por contagem nos dedos, o que deixa as respostas lentas e sujeitas a erro. Sugerimos jogos curtos de memorização (cartas, bingo de resultados) e relacionar multiplicação a grupos de objetos do cotidiano, como caixas de ovos.",
    "mat-fracoes": "A ideia de \"metade\" está consolidada, mas terço e quarto ainda são confundidos. Atividades com objetos reais — dividir uma pizza de papel, uma barra de chocolate — ajudam a ver que partes iguais ficam menores quando o número de partes aumenta.",
    "EF35LP03": "A leitura está fluente, mas as respostas sobre a ideia principal do texto indicam que a compreensão ainda fica na superfície. Depois de cada leitura curta, peça que a criança conte a história com as próprias palavras e diga qual parte achou mais importante e por quê.",
    "EF04LP01": "Os erros se concentram em s, ss e ç. Um caderno de palavras \"que enganam\", montado pela própria criança, e ditados curtos com palavras do dia a dia ajudam a fixar o padrão sem transformar o treino em punição.",
    "geo-orientacao": "Os pontos cardeais ainda são decorados, mas não usados: a criança acerta \"onde o sol nasce\" e erra quando precisa se orientar a partir do próprio corpo. Brincadeiras de caça ao tesouro no pátio, com pistas do tipo \"dez passos para o norte\", e desenhar o caminho de casa até a escola ajudam a transformar a regra em referência.",
    "geo-paisagem": "Distingue bem o natural do construído, mas ainda não relaciona as mudanças na paisagem com as consequências. Comparar duas fotos do mesmo lugar em épocas diferentes e perguntar \"o que mudou e o que isso causou?\" é um bom exercício.",
    "cie-seres-vivos": "Reconhece os seres vivos, mas a cadeia alimentar ainda é confusa: inverte quem come quem. Montar a cadeia com cartões recortados (sol → planta → animal) e brincar de \"quem depende de quem\" costuma resolver em poucas semanas.",
    "cie-materia": "Os estados físicos da água estão claros no gelo e no vapor, mas a condensação ainda não. Um copo de água gelada na mesa da sala e a pergunta \"de onde vieram essas gotinhas?\" rendem uma boa conversa de cinco minutos.",
    "ing-vocabulario": "O vocabulário de cores e animais está consolidado; números acima de dez ainda geram dúvida. Cantar a contagem em inglês durante rotinas (fila, organização da sala) ajuda sem tomar tempo de aula.",
    "ing-frases": "Entende cumprimentos, mas ainda não reconhece perguntas sobre si mesmo (\"How old are you?\"). Diálogos curtos em dupla, com as mesmas três perguntas toda semana, criam a segurança para responder sem traduzir.",
}

with open(os.path.join(os.path.dirname(__file__), "bncc", "curadas.json"), encoding="utf-8") as _f:
    _BANCO_POR_HABILIDADE: dict[str, list] = json.load(_f)


def _embaralhar(id_: str, opcoes: list[str]) -> dict:
    giro = sum(ord(c) for c in id_) % len(opcoes)
    return {"opcoes": opcoes[giro:] + opcoes[:giro], "certa": (len(opcoes) - giro) % len(opcoes)}


def _construir_banco() -> list[dict]:
    banco: list[dict] = []
    ids = set(HAB_POR_ID)
    for habilidade_id, linhas in _BANCO_POR_HABILIDADE.items():
        if habilidade_id not in ids:
            continue
        for id_, nivel, enunciado, opcoes, extra in linhas:
            p = {"id": id_, "habilidadeId": habilidade_id, "nivel": nivel, "enunciado": enunciado, "apoio": extra.get("apoio"), "origem": "curada"}
            if extra.get("certa") is None:
                p.update(_embaralhar(id_, opcoes))
            else:
                p.update({"opcoes": opcoes, "certa": extra["certa"]})
            banco.append(p)
    return banco


BANCO = _construir_banco() + [p for p in catalogo.perguntas_geradas() if p["habilidadeId"] in HAB_POR_ID]
COM_PERGUNTAS = {p["habilidadeId"] for p in BANCO}


def disciplinas_com_conteudo(ano: int) -> list[str]:
    ids_ano = {h["id"] for h in habilidades_do_ano(ano)} & COM_PERGUNTAS
    return [d["id"] for d in DISCIPLINAS if any(HAB_POR_ID[h]["disciplina"] == d["nome"] for h in ids_ano)]


ANOS_COM_CONTEUDO = [ano for ano in ANOS if disciplinas_com_conteudo(ano)]


TURMA_8 = {"id": "t8", "nome": "8º ano A", "codigo": "TUCANO8", "ano": 8}
ALUNOS_8 = [
    {"id": "b1", "nome": "Beatriz Gomes", "pin": "4821"},
    {"id": "b2", "nome": "Larissa Campos", "pin": "3175"},
    {"id": "b3", "nome": "Lucas Andrade", "pin": "9064"},
    {"id": "b4", "nome": "Mariana Ribeiro", "pin": "2738"},
    {"id": "b5", "nome": "Rafael Teixeira", "pin": "5912"},
    {"id": "b6", "nome": "Thiago Moreira", "pin": "6340"},
]
