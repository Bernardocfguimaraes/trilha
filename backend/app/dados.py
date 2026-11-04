"""Dados de exemplo (seed) — port de src/lib/mock.ts e src/lib/mock-perguntas.ts.

Enquanto o banco real (Supabase) não entra, estes dados vivem em memória. O formato
é o mesmo que o frontend já espera. Quando o Postgres assumir, só a origem dos dados
muda; os esquemas e as regras continuam iguais.

Catálogo: disciplinas que já têm caminho BNCC (app/bncc/caminhos/) vêm de catalogo.py, com
o código BNCC como id. As demais ainda usam o catálogo antigo, escrito à mão (piloto: só
Português do 4º ano já está na BNCC).
"""
from __future__ import annotations

from . import catalogo

TURMA = {"id": "t1", "nome": "4º ano B", "codigo": "SABIA4", "ano": 4}

# Ordem em que as disciplinas aparecem para o aluno.
DISCIPLINAS = [
    {"id": "por", "nome": "Português"},
    {"id": "mat", "nome": "Matemática"},
    {"id": "geo", "nome": "Geografia"},
    {"id": "cie", "nome": "Ciências"},
    {"id": "ing", "nome": "Inglês"},
]


def nome_disciplina(id_: str) -> str | None:
    for d in DISCIPLINAS:
        if d["id"] == id_:
            return d["nome"]
    return None


def id_disciplina(nome: str) -> str | None:
    return next((d["id"] for d in DISCIPLINAS if d["nome"] == nome), None)


def _legado(id_: str, nome: str, disciplina: str, descricao: str) -> dict:
    """Habilidade do catálogo antigo (ainda sem caminho BNCC)."""
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

# Ordem da matriz do painel: Matemática, Português, Geografia, Ciências, Inglês.
_ORDEM_MATRIZ = ["mat", "por", "geo", "cie", "ing"]


def _catalogo_completo(ano: int) -> list[dict]:
    saida: list[dict] = []
    for did in _ORDEM_MATRIZ:
        if catalogo.tem_caminho(ano, did):
            saida.extend(catalogo.caminho(ano, did, nome_disciplina(did)))
        else:
            saida.extend(_LEGADO.get(did, []))
    return saida


# Catálogo inteiro da turma, inclusive habilidades "em sala" (não avaliáveis): é o que o
# professor vê na configuração do caminho.
CATALOGO = _catalogo_completo(TURMA["ano"])
# Só as avaliáveis: entram no quiz, no diagnóstico e na matriz do painel.
HABILIDADES = [h for h in CATALOGO if h["avaliavel"]]


def ordem_caminho(disciplina_id: str) -> list[str] | None:
    """Ids do caminho BNCC da disciplina que o aluno consegue praticar (avaliáveis e com
    questões no banco), em ordem; None se ainda é catálogo antigo. Habilidade sem questão
    fica de fora para o caminho não travar nela (a sessão não teria o que perguntar); ela
    entra sozinha quando o lote de geração cobrir."""
    if not catalogo.tem_caminho(TURMA["ano"], disciplina_id):
        return None
    nome = nome_disciplina(disciplina_id)
    com_perguntas = {p["habilidadeId"] for p in BANCO}
    return [h["id"] for h in HABILIDADES if h["disciplina"] == nome and h["id"] in com_perguntas]


# Status de exemplo da demo (o: ok, a: atenção, x: alerta). Matemática, Geografia, Ciências e
# Inglês seguem as strings originais (ordem _ORDEM_LEGADA); Português agora é por código BNCC.
# Habilidade sem status = ainda não praticada (fica adiante no caminho).
_ORDEM_LEGADA = ["mat-adicao", "mat-mult", "mat-fracoes", "mat-problemas", None, None, None,
                 "geo-orientacao", "geo-paisagem", "cie-seres-vivos", "cie-materia", "ing-vocabulario", "ing-frases"]
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


# alunoId -> {habilidadeId: status} — só habilidades já praticadas na demo.
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

# Banco de perguntas: id, nivel, enunciado, opções (resposta certa sempre primeiro),
# extra opcional {apoio, certa}. A ordem é embaralhada de forma determinística em BANCO.
_BANCO_POR_HABILIDADE: dict[str, list] = {
    # Matemática
    "mat-adicao": [
        ["ad1", "facil", "Quanto é 5 + 3?", ["8", "7", "9", "6"], {}],
        ["ad2", "facil", "Quantas maçãs tem ao todo?", ["5", "4", "6", "3"], {"apoio": "🍎🍎🍎 + 🍎🍎"}],
        ["p1", "medio", "Quantas maçãs tem ao todo?", ["11", "12", "13", "10"], {"apoio": "🍎🍎🍎🍎🍎🍎🍎 + 🍎🍎🍎🍎🍎", "certa": 1}],
        ["p6", "medio", "Quanto é 45 − 18?", ["33", "27", "23", "37"], {"certa": 1}],
        ["ad5", "dificil", "Quanto é 368 + 254?", ["622", "612", "512", "632"], {}],
        ["ad6", "dificil", "Quanto é 503 − 178?", ["325", "335", "475", "435"], {}],
    ],
    "mat-mult": [
        ["mu1", "facil", "Quanto é 2 × 4?", ["8", "6", "10", "2"], {}],
        ["mu2", "facil", "Quantas rodas têm 3 bicicletas?", ["6", "5", "3", "9"], {"apoio": "🚲 🚲 🚲"}],
        ["p3", "medio", "Lia tem 3 caixas com 4 lápis em cada uma. Quantos lápis ela tem?", ["7", "10", "12", "16"], {"apoio": "✏️✏️✏️✏️   ✏️✏️✏️✏️   ✏️✏️✏️✏️", "certa": 2}],
        ["mu4", "medio", "Quanto é 6 × 7?", ["42", "36", "48", "13"], {}],
        ["mu5", "dificil", "Quanto é 8 × 9?", ["72", "64", "81", "63"], {}],
        ["mu6", "dificil", "Quanto é 23 × 4?", ["92", "82", "96", "86"], {}],
    ],
    "mat-fracoes": [
        ["p5", "facil", "Qual pedaço é a metade da pizza?", ["1 de 2 pedaços", "1 de 3 pedaços", "1 de 4 pedaços", "2 de 3 pedaços"], {"apoio": "🍕", "certa": 0}],
        ["fr2", "facil", "Uma barra de chocolate foi dividida em 2 partes iguais. Cada parte é…", ["a metade", "um terço", "um quarto", "a barra inteira"], {}],
        ["fr3", "medio", "Uma pizza foi cortada em 4 pedaços iguais. Comi 1. Que parte da pizza eu comi?", ["um quarto", "um terço", "a metade", "quatro pizzas"], {}],
        ["fr4", "medio", "Qual é a metade de 10?", ["5", "2", "20", "8"], {}],
        ["fr5", "dificil", "Qual pedaço é maior: um terço ou um quarto da mesma pizza?", ["um terço", "um quarto", "são iguais", "não dá para saber"], {}],
        ["fr6", "dificil", "Quanto é um quarto de 12 balas?", ["3", "4", "6", "8"], {}],
    ],
    "mat-problemas": [
        ["pr1", "facil", "Tenho 4 figurinhas e ganhei mais 3. Quantas tenho agora?", ["7", "1", "6", "8"], {}],
        ["pr2", "facil", "Havia 6 passarinhos na árvore. 2 voaram. Quantos ficaram?", ["4", "8", "3", "5"], {"apoio": "🐦🐦🐦🐦🐦🐦"}],
        ["pr3", "medio", "Uma caixa tem 10 ovos. Quantos ovos há em 3 caixas?", ["30", "13", "20", "33"], {}],
        ["pr4", "medio", "Pedro tinha 25 reais e gastou 12. Quanto sobrou?", ["13", "37", "12", "17"], {}],
        ["pr5", "dificil", "Uma escola tem 4 turmas com 28 alunos cada. Quantos alunos são ao todo?", ["112", "102", "32", "122"], {}],
        ["pr6", "dificil", "Maria comprou 3 cadernos de 7 reais e pagou com 50 reais. Quanto recebeu de troco?", ["29", "43", "21", "31"], {}],
    ],
    # Português (4º ano, BNCC). Questões do banco antigo remapeadas para o código da habilidade.
    # Saíram do 4º ano: "or5" (proparoxítona, é EF05LP03) e "pt1", "pt3", "pt5" (produção de
    # texto, que fica "em sala" no caminho).
    "EF15LP03": [
        ["le1", "facil", "\"Lia tem um cachorro chamado Bolinha.\" Qual é o nome do cachorro?", ["Bolinha", "Lia", "Totó", "Rex"], {}],
        ["le2", "facil", "\"O sol estava forte, então Caio usou boné.\" Por que Caio usou boné?", ["Porque o sol estava forte", "Porque estava chovendo", "Porque estava com frio", "Porque ganhou de presente"], {}],
        ["p4", "medio", "\"O gato subiu no telhado porque viu um passarinho.\" Por que o gato subiu?", ["Porque estava com frio", "Porque viu um passarinho", "Porque queria dormir", "Porque a porta fechou"], {"certa": 1}],
        ["le4", "medio", "\"Bia acordou cedo, tomou café e foi para a escola de bicicleta.\" Como Bia foi para a escola?", ["De bicicleta", "De ônibus", "A pé", "De carro"], {}],
        ["le5", "dificil", "\"Quando a chuva parou, as crianças correram para o quintal e pularam nas poças.\" O que aconteceu primeiro?", ["A chuva parou", "As crianças pularam nas poças", "As crianças correram", "O quintal secou"], {}],
    ],
    "EF35LP04": [
        ["le6", "dificil", "\"Mesmo cansado, Léo terminou a corrida e abraçou os amigos, sorrindo.\" Como Léo se sentiu no final?", ["Feliz", "Triste", "Bravo", "Com medo"], {}],
    ],
    "EF04LP01": [
        ["or1", "facil", "Qual palavra está escrita certinho?", ["casa", "caza", "kasa", "cassa"], {}],
        ["or2", "facil", "Qual palavra está escrita certinho?", ["cachorro", "cachoro", "caxorro", "cachorrro"], {}],
        ["p2", "medio", "Qual palavra está escrita certinho?", ["cabeça", "cabessa", "cabesa", "cabeca"], {"certa": 0}],
        ["or4", "medio", "Qual letra completa a palavra? pa__arinho", ["ss", "s", "ç", "c"], {}],
    ],
    "EF35LP13": [
        ["or6", "dificil", "Qual frase está escrita certinho?", ["Eu desci a escada.", "Eu dece a escada.", "Eu desi a escada.", "Eu dessi a escada."], {}],
    ],
    "EF04LP05": [
        ["pt2", "facil", "Como começa uma frase?", ["Com letra maiúscula", "Com ponto final", "Com vírgula", "Com um número"], {}],
        ["pt4", "medio", "Qual sinal termina uma pergunta?", ["?", ".", "!", ","], {}],
        ["pt6", "dificil", "Qual frase usa a vírgula certinho?", ["Comprei pão, leite e ovos.", "Comprei, pão leite e ovos.", "Comprei pão leite, e ovos.", "Comprei pão leite e, ovos."], {}],
    ],
    # Geografia
    "geo-orientacao": [
        ["go1", "facil", "Para que serve um mapa?", ["Mostrar onde ficam os lugares", "Contar histórias", "Medir a temperatura", "Fazer contas"], {}],
        ["go2", "facil", "De que lado o sol nasce?", ["Leste", "Oeste", "Norte", "Sul"], {"apoio": "🌅"}],
        ["go3", "medio", "De manhã, o sol nasce do seu lado direito. Para onde você está olhando?", ["Norte", "Sul", "Leste", "Oeste"], {}],
        ["go4", "medio", "No mapa, o que a legenda mostra?", ["O que cada símbolo quer dizer", "O nome de quem fez o mapa", "A data de hoje", "O preço do mapa"], {}],
        ["go5", "dificil", "Quem está de frente para o Norte tem o Oeste de qual lado?", ["Esquerdo", "Direito", "Atrás", "Na frente"], {}],
        ["go6", "dificil", "No mapa, 1 centímetro vale 1 quilômetro. Duas cidades estão a 5 centímetros no mapa. Qual é a distância de verdade?", ["5 km", "1 km", "50 km", "10 km"], {}],
    ],
    "geo-paisagem": [
        ["gp1", "facil", "Qual destes foi feito pela natureza?", ["Rio", "Ponte", "Prédio", "Rua"], {}],
        ["gp2", "facil", "Qual destes foi construído pelas pessoas?", ["Ponte", "Montanha", "Mar", "Floresta"], {}],
        ["gp3", "medio", "Uma paisagem com prédios, ruas e muitos carros é do…", ["Cidade", "Campo", "Deserto", "Fundo do mar"], {}],
        ["gp4", "medio", "Onde é mais comum ver plantações e criação de animais?", ["No campo", "No centro da cidade", "No shopping", "No aeroporto"], {}],
        ["gp5", "dificil", "Por que cortar as árvores da beira de um rio prejudica o rio?", ["A terra escorre para o rio e ele fica raso", "O rio fica mais limpo", "A água fica mais gelada", "Os peixes ficam maiores"], {}],
        ["gp6", "dificil", "Uma cidade asfaltou muitas ruas. O que pode acontecer quando chove forte?", ["Alagamentos, porque a água não entra no chão", "Nada muda", "O sol aparece mais rápido", "Os rios secam"], {}],
    ],
    # Ciências
    "cie-seres-vivos": [
        ["cs1", "facil", "Qual destes é um ser vivo?", ["Árvore", "Pedra", "Cadeira", "Bola"], {}],
        ["cs2", "facil", "Do que uma planta precisa para crescer?", ["Água e luz", "Chocolate", "Escuridão total", "Plástico"], {"apoio": "🌱"}],
        ["cs3", "medio", "Qual animal tem o corpo coberto de penas?", ["Galinha", "Cachorro", "Peixe", "Sapo"], {}],
        ["cs4", "medio", "O que a lagarta vira quando cresce?", ["Borboleta", "Minhoca", "Abelha", "Aranha"], {"apoio": "🐛"}],
        ["cs5", "dificil", "Na cadeia alimentar capim → coelho → raposa, quem come o coelho?", ["A raposa", "O capim", "Ninguém", "Outro coelho"], {}],
        ["cs6", "dificil", "Por que as plantas são chamadas de produtoras?", ["Fazem o próprio alimento com a luz do sol", "Comem outros animais", "Produzem pedras", "Vivem para sempre"], {}],
    ],
    "cie-materia": [
        ["cm1", "facil", "O gelo derretendo vira…", ["Água", "Pedra", "Fogo", "Areia"], {"apoio": "🧊"}],
        ["cm2", "facil", "Qual destes materiais é transparente?", ["Vidro", "Madeira", "Ferro", "Papelão"], {}],
        ["cm3", "medio", "O que acontece com a água quando ferve bastante?", ["Vira vapor", "Vira gelo", "Fica mais pesada", "Muda de cor"], {}],
        ["cm4", "medio", "Qual objeto o ímã atrai?", ["Prego de ferro", "Borracha", "Lápis de madeira", "Copo de vidro"], {"apoio": "🧲"}],
        ["cm5", "dificil", "Por que aparecem gotinhas do lado de fora de um copo com água gelada?", ["O vapor do ar esfria e vira água", "O copo está furado", "A água atravessa o vidro", "O gelo pula para fora"], {}],
        ["cm6", "dificil", "Complete a ordem: gelo → ??? → vapor", ["Água líquida", "Areia", "Fumaça", "Sal"], {}],
    ],
    # Inglês
    "ing-vocabulario": [
        ["iv1", "facil", "Como se diz \"gato\" em inglês?", ["cat", "dog", "bird", "fish"], {"apoio": "🐱"}],
        ["iv2", "facil", "Qual é a cor \"red\"?", ["Vermelho", "Azul", "Verde", "Amarelo"], {}],
        ["iv3", "medio", "Qual número é \"seven\"?", ["7", "6", "8", "11"], {}],
        ["iv4", "medio", "Como se diz \"maçã\" em inglês?", ["apple", "orange", "banana", "grape"], {"apoio": "🍎"}],
        ["iv5", "dificil", "Qual destes animais é o \"elephant\"?", ["🐘", "🐒", "🦒", "🦁"], {}],
        ["iv6", "dificil", "Quanto é \"three\" + \"four\"?", ["seven", "six", "eight", "five"], {}],
    ],
    "ing-frases": [
        ["if1", "facil", "Como se diz \"Olá\" em inglês?", ["Hello", "Goodbye", "Thanks", "Sorry"], {}],
        ["if2", "facil", "O que quer dizer \"Thank you\"?", ["Obrigado", "Desculpa", "Tchau", "Bom dia"], {}],
        ["if3", "medio", "Alguém pergunta \"What is your name?\". O que você responde?", ["My name is Ana.", "I am fine.", "Good night.", "It is blue."], {}],
        ["if4", "medio", "Quando a gente diz \"Good morning\"?", ["De manhã", "À noite", "Na hora de dormir", "Só no almoço"], {"apoio": "☀️"}],
        ["if5", "dificil", "A pergunta \"How old are you?\" quer saber…", ["Sua idade", "Seu nome", "Onde você mora", "Sua cor favorita"], {}],
        ["if6", "dificil", "Complete: \"She ___ a dog.\"", ["has", "have", "is", "are"], {}],
    ],
}


def _embaralhar(id_: str, opcoes: list[str]) -> dict:
    """Mesma rotação determinística do frontend (mock-perguntas.ts)."""
    giro = sum(ord(c) for c in id_) % len(opcoes)
    return {"opcoes": opcoes[giro:] + opcoes[:giro], "certa": (len(opcoes) - giro) % len(opcoes)}


def _construir_banco() -> list[dict]:
    banco: list[dict] = []
    ids = {h["id"] for h in HABILIDADES}
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


# Banco curado (fallback) + questões geradas por IA e validadas (app/bncc/perguntas/).
BANCO = _construir_banco() + [p for p in catalogo.perguntas_geradas() if p["habilidadeId"] in _IDS]
