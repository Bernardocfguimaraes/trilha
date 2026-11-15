const POR_DISCIPLINA: Record<string, string> = {
  Matemática:
    "Leve “{nome}” para o dia a dia: contas na hora das compras, dividir uma receita ou medir objetos da casa. Peça que o estudante explique em voz alta como chegou ao resultado e comece por exemplos fáceis antes de aumentar o desafio.",
  Português:
    "Leiam juntos textos curtos de que o estudante goste, como gibis, receitas ou notícias, e conversem sobre eles pensando em “{nome}”. Peça que ele mostre no texto onde encontrou cada resposta.",
  Ciências:
    "Observem juntos situações do cotidiano ligadas a “{nome}”: plantas, água, alimentos e objetos da casa. Façam perguntas como “por que será?” e registrem as descobertas num caderno, com desenhos.",
  Geografia:
    "Explore “{nome}” a partir do lugar onde o estudante vive: o caminho até a escola, o bairro, um mapa no celular. Peça que ele descreva ou desenhe o que vê, usando referências como perto, longe, direita e esquerda.",
  História:
    "Relacione “{nome}” à história da família e da cidade: fotos antigas, conversas com os avós, objetos de outras épocas. Pergunte o que mudou e o que continua igual, e deixe o estudante contar com as próprias palavras.",
  Inglês:
    "Pratique “{nome}” em momentos curtos e divertidos: músicas, desenhos com áudio em inglês, nomes de objetos da casa. Repetir as mesmas palavras e frases durante a semana dá segurança para usar o idioma.",
};

const PADRAO =
  "Reserve alguns minutos para praticar “{nome}” com atividades curtas do dia a dia, elogiando o esforço. Peça que o estudante explique o que entendeu com as próprias palavras.";

const FECHO: Record<string, string> = {
  alerta:
    " Como a dificuldade ainda é grande, vale praticar um pouco todos os dias, com calma.",
  atencao: " Uma prática curta algumas vezes por semana já ajuda.",
};

export const recomendacaoPadrao = (
  nome: string,
  disciplina: string,
  status: string,
) =>
  (POR_DISCIPLINA[disciplina] ?? PADRAO).replace("{nome}", nome) +
  (FECHO[status] ?? "");
