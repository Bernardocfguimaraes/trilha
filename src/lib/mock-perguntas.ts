// Banco de perguntas de exemplo do mock (src/lib/mock.ts): duas perguntas por nível
// (fácil, médio, difícil) para cada habilidade. No produto real o banco vem do backend.
import type { Nivel } from "./types";

export interface PerguntaBanco {
  id: string;
  habilidadeId: string;
  nivel: Nivel;
  enunciado: string;
  apoio?: string;
  opcoes: string[];
  certa: number;
}

// Nas linhas abaixo a resposta certa vem sempre primeiro, para facilitar a leitura;
// `embaralhar` muda a posição de forma determinística. Com `certa` explícita, a ordem é mantida.
type Linha = [id: string, nivel: Nivel, enunciado: string, opcoes: string[], extra?: { apoio?: string; certa?: number }];

const BANCO_POR_HABILIDADE: Record<string, Linha[]> = {
  // Matemática
  "mat-adicao": [
    ["ad1", "facil", "Quanto é 5 + 3?", ["8", "7", "9", "6"]],
    ["ad2", "facil", "Quantas maçãs tem ao todo?", ["5", "4", "6", "3"], { apoio: "🍎🍎🍎 + 🍎🍎" }],
    ["p1", "medio", "Quantas maçãs tem ao todo?", ["11", "12", "13", "10"], { apoio: "🍎🍎🍎🍎🍎🍎🍎 + 🍎🍎🍎🍎🍎", certa: 1 }],
    ["p6", "medio", "Quanto é 45 − 18?", ["33", "27", "23", "37"], { certa: 1 }],
    ["ad5", "dificil", "Quanto é 368 + 254?", ["622", "612", "512", "632"]],
    ["ad6", "dificil", "Quanto é 503 − 178?", ["325", "335", "475", "435"]],
  ],
  "mat-mult": [
    ["mu1", "facil", "Quanto é 2 × 4?", ["8", "6", "10", "2"]],
    ["mu2", "facil", "Quantas rodas têm 3 bicicletas?", ["6", "5", "3", "9"], { apoio: "🚲 🚲 🚲" }],
    ["p3", "medio", "Lia tem 3 caixas com 4 lápis em cada uma. Quantos lápis ela tem?", ["7", "10", "12", "16"], { apoio: "✏️✏️✏️✏️   ✏️✏️✏️✏️   ✏️✏️✏️✏️", certa: 2 }],
    ["mu4", "medio", "Quanto é 6 × 7?", ["42", "36", "48", "13"]],
    ["mu5", "dificil", "Quanto é 8 × 9?", ["72", "64", "81", "63"]],
    ["mu6", "dificil", "Quanto é 23 × 4?", ["92", "82", "96", "86"]],
  ],
  "mat-fracoes": [
    ["p5", "facil", "Qual pedaço é a metade da pizza?", ["1 de 2 pedaços", "1 de 3 pedaços", "1 de 4 pedaços", "2 de 3 pedaços"], { apoio: "🍕", certa: 0 }],
    ["fr2", "facil", "Uma barra de chocolate foi dividida em 2 partes iguais. Cada parte é…", ["a metade", "um terço", "um quarto", "a barra inteira"]],
    ["fr3", "medio", "Uma pizza foi cortada em 4 pedaços iguais. Comi 1. Que parte da pizza eu comi?", ["um quarto", "um terço", "a metade", "quatro pizzas"]],
    ["fr4", "medio", "Qual é a metade de 10?", ["5", "2", "20", "8"]],
    ["fr5", "dificil", "Qual pedaço é maior: um terço ou um quarto da mesma pizza?", ["um terço", "um quarto", "são iguais", "não dá para saber"]],
    ["fr6", "dificil", "Quanto é um quarto de 12 balas?", ["3", "4", "6", "8"]],
  ],
  "mat-problemas": [
    ["pr1", "facil", "Tenho 4 figurinhas e ganhei mais 3. Quantas tenho agora?", ["7", "1", "6", "8"]],
    ["pr2", "facil", "Havia 6 passarinhos na árvore. 2 voaram. Quantos ficaram?", ["4", "8", "3", "5"], { apoio: "🐦🐦🐦🐦🐦🐦" }],
    ["pr3", "medio", "Uma caixa tem 10 ovos. Quantos ovos há em 3 caixas?", ["30", "13", "20", "33"]],
    ["pr4", "medio", "Pedro tinha 25 reais e gastou 12. Quanto sobrou?", ["13", "37", "12", "17"]],
    ["pr5", "dificil", "Uma escola tem 4 turmas com 28 alunos cada. Quantos alunos são ao todo?", ["112", "102", "32", "122"]],
    ["pr6", "dificil", "Maria comprou 3 cadernos de 7 reais e pagou com 50 reais. Quanto recebeu de troco?", ["29", "43", "21", "31"]],
  ],

  // Português
  "por-leitura": [
    ["le1", "facil", "\"Lia tem um cachorro chamado Bolinha.\" Qual é o nome do cachorro?", ["Bolinha", "Lia", "Totó", "Rex"]],
    ["le2", "facil", "\"O sol estava forte, então Caio usou boné.\" Por que Caio usou boné?", ["Porque o sol estava forte", "Porque estava chovendo", "Porque estava com frio", "Porque ganhou de presente"]],
    ["p4", "medio", "\"O gato subiu no telhado porque viu um passarinho.\" Por que o gato subiu?", ["Porque estava com frio", "Porque viu um passarinho", "Porque queria dormir", "Porque a porta fechou"], { certa: 1 }],
    ["le4", "medio", "\"Bia acordou cedo, tomou café e foi para a escola de bicicleta.\" Como Bia foi para a escola?", ["De bicicleta", "De ônibus", "A pé", "De carro"]],
    ["le5", "dificil", "\"Quando a chuva parou, as crianças correram para o quintal e pularam nas poças.\" O que aconteceu primeiro?", ["A chuva parou", "As crianças pularam nas poças", "As crianças correram", "O quintal secou"]],
    ["le6", "dificil", "\"Mesmo cansado, Léo terminou a corrida e abraçou os amigos, sorrindo.\" Como Léo se sentiu no final?", ["Feliz", "Triste", "Bravo", "Com medo"]],
  ],
  "por-ortografia": [
    ["or1", "facil", "Qual palavra está escrita certinho?", ["casa", "caza", "kasa", "cassa"]],
    ["or2", "facil", "Qual palavra está escrita certinho?", ["cachorro", "cachoro", "caxorro", "cachorrro"]],
    ["p2", "medio", "Qual palavra está escrita certinho?", ["cabeça", "cabessa", "cabesa", "cabeca"], { certa: 0 }],
    ["or4", "medio", "Qual letra completa a palavra? pa__arinho", ["ss", "s", "ç", "c"]],
    ["or5", "dificil", "Qual destas palavras precisa de acento?", ["onibus", "mesa", "bola", "janela"]],
    ["or6", "dificil", "Qual frase está escrita certinho?", ["Eu desci a escada.", "Eu dece a escada.", "Eu desi a escada.", "Eu dessi a escada."]],
  ],
  "por-producao": [
    ["pt1", "facil", "Qual frase está completa?", ["O menino jogou bola.", "O menino.", "Jogou bola.", "Bola o menino."]],
    ["pt2", "facil", "Como começa uma frase?", ["Com letra maiúscula", "Com ponto final", "Com vírgula", "Com um número"]],
    ["pt3", "medio", "Qual é o melhor fim para a história? \"A gata subiu na árvore e não conseguia descer…\"", ["Então o bombeiro ajudou a gata a descer.", "A árvore é verde.", "Eu gosto de suco.", "Era uma vez."]],
    ["pt4", "medio", "Qual sinal termina uma pergunta?", ["?", ".", "!", ","]],
    ["pt5", "dificil", "Qual palavra liga melhor as frases? \"Choveu muito, ___ o jogo foi adiado.\"", ["por isso", "mas", "ou", "porque"]],
    ["pt6", "dificil", "Qual frase usa a vírgula certinho?", ["Comprei pão, leite e ovos.", "Comprei, pão leite e ovos.", "Comprei pão leite, e ovos.", "Comprei pão leite e, ovos."]],
  ],

  // Geografia
  "geo-orientacao": [
    ["go1", "facil", "Para que serve um mapa?", ["Mostrar onde ficam os lugares", "Contar histórias", "Medir a temperatura", "Fazer contas"]],
    ["go2", "facil", "De que lado o sol nasce?", ["Leste", "Oeste", "Norte", "Sul"], { apoio: "🌅" }],
    ["go3", "medio", "De manhã, o sol nasce do seu lado direito. Para onde você está olhando?", ["Norte", "Sul", "Leste", "Oeste"]],
    ["go4", "medio", "No mapa, o que a legenda mostra?", ["O que cada símbolo quer dizer", "O nome de quem fez o mapa", "A data de hoje", "O preço do mapa"]],
    ["go5", "dificil", "Quem está de frente para o Norte tem o Oeste de qual lado?", ["Esquerdo", "Direito", "Atrás", "Na frente"]],
    ["go6", "dificil", "No mapa, 1 centímetro vale 1 quilômetro. Duas cidades estão a 5 centímetros no mapa. Qual é a distância de verdade?", ["5 km", "1 km", "50 km", "10 km"]],
  ],
  "geo-paisagem": [
    ["gp1", "facil", "Qual destes foi feito pela natureza?", ["Rio", "Ponte", "Prédio", "Rua"]],
    ["gp2", "facil", "Qual destes foi construído pelas pessoas?", ["Ponte", "Montanha", "Mar", "Floresta"]],
    ["gp3", "medio", "Uma paisagem com prédios, ruas e muitos carros é do…", ["Cidade", "Campo", "Deserto", "Fundo do mar"]],
    ["gp4", "medio", "Onde é mais comum ver plantações e criação de animais?", ["No campo", "No centro da cidade", "No shopping", "No aeroporto"]],
    ["gp5", "dificil", "Por que cortar as árvores da beira de um rio prejudica o rio?", ["A terra escorre para o rio e ele fica raso", "O rio fica mais limpo", "A água fica mais gelada", "Os peixes ficam maiores"]],
    ["gp6", "dificil", "Uma cidade asfaltou muitas ruas. O que pode acontecer quando chove forte?", ["Alagamentos, porque a água não entra no chão", "Nada muda", "O sol aparece mais rápido", "Os rios secam"]],
  ],

  // Ciências
  "cie-seres-vivos": [
    ["cs1", "facil", "Qual destes é um ser vivo?", ["Árvore", "Pedra", "Cadeira", "Bola"]],
    ["cs2", "facil", "Do que uma planta precisa para crescer?", ["Água e luz", "Chocolate", "Escuridão total", "Plástico"], { apoio: "🌱" }],
    ["cs3", "medio", "Qual animal tem o corpo coberto de penas?", ["Galinha", "Cachorro", "Peixe", "Sapo"]],
    ["cs4", "medio", "O que a lagarta vira quando cresce?", ["Borboleta", "Minhoca", "Abelha", "Aranha"], { apoio: "🐛" }],
    ["cs5", "dificil", "Na cadeia alimentar capim → coelho → raposa, quem come o coelho?", ["A raposa", "O capim", "Ninguém", "Outro coelho"]],
    ["cs6", "dificil", "Por que as plantas são chamadas de produtoras?", ["Fazem o próprio alimento com a luz do sol", "Comem outros animais", "Produzem pedras", "Vivem para sempre"]],
  ],
  "cie-materia": [
    ["cm1", "facil", "O gelo derretendo vira…", ["Água", "Pedra", "Fogo", "Areia"], { apoio: "🧊" }],
    ["cm2", "facil", "Qual destes materiais é transparente?", ["Vidro", "Madeira", "Ferro", "Papelão"]],
    ["cm3", "medio", "O que acontece com a água quando ferve bastante?", ["Vira vapor", "Vira gelo", "Fica mais pesada", "Muda de cor"]],
    ["cm4", "medio", "Qual objeto o ímã atrai?", ["Prego de ferro", "Borracha", "Lápis de madeira", "Copo de vidro"], { apoio: "🧲" }],
    ["cm5", "dificil", "Por que aparecem gotinhas do lado de fora de um copo com água gelada?", ["O vapor do ar esfria e vira água", "O copo está furado", "A água atravessa o vidro", "O gelo pula para fora"]],
    ["cm6", "dificil", "Complete a ordem: gelo → ??? → vapor", ["Água líquida", "Areia", "Fumaça", "Sal"]],
  ],

  // Inglês
  "ing-vocabulario": [
    ["iv1", "facil", "Como se diz \"gato\" em inglês?", ["cat", "dog", "bird", "fish"], { apoio: "🐱" }],
    ["iv2", "facil", "Qual é a cor \"red\"?", ["Vermelho", "Azul", "Verde", "Amarelo"]],
    ["iv3", "medio", "Qual número é \"seven\"?", ["7", "6", "8", "11"]],
    ["iv4", "medio", "Como se diz \"maçã\" em inglês?", ["apple", "orange", "banana", "grape"], { apoio: "🍎" }],
    ["iv5", "dificil", "Qual destes animais é o \"elephant\"?", ["🐘", "🐒", "🦒", "🦁"]],
    ["iv6", "dificil", "Quanto é \"three\" + \"four\"?", ["seven", "six", "eight", "five"]],
  ],
  "ing-frases": [
    ["if1", "facil", "Como se diz \"Olá\" em inglês?", ["Hello", "Goodbye", "Thanks", "Sorry"]],
    ["if2", "facil", "O que quer dizer \"Thank you\"?", ["Obrigado", "Desculpa", "Tchau", "Bom dia"]],
    ["if3", "medio", "Alguém pergunta \"What is your name?\". O que você responde?", ["My name is Ana.", "I am fine.", "Good night.", "It is blue."]],
    ["if4", "medio", "Quando a gente diz \"Good morning\"?", ["De manhã", "À noite", "Na hora de dormir", "Só no almoço"], { apoio: "☀️" }],
    ["if5", "dificil", "A pergunta \"How old are you?\" quer saber…", ["Sua idade", "Seu nome", "Onde você mora", "Sua cor favorita"]],
    ["if6", "dificil", "Complete: \"She ___ a dog.\"", ["has", "have", "is", "are"]],
  ],
};

function embaralhar(id: string, opcoes: string[]) {
  const giro = [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % opcoes.length;
  return { opcoes: [...opcoes.slice(giro), ...opcoes.slice(0, giro)], certa: (opcoes.length - giro) % opcoes.length };
}

export const BANCO: PerguntaBanco[] = Object.entries(BANCO_POR_HABILIDADE).flatMap(([habilidadeId, linhas]) =>
  linhas.map(([id, nivel, enunciado, opcoes, extra = {}]) => ({
    id,
    habilidadeId,
    nivel,
    enunciado,
    apoio: extra.apoio,
    ...(extra.certa === undefined ? embaralhar(id, opcoes) : { opcoes, certa: extra.certa }),
  })),
);
