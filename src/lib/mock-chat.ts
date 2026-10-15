// PLACEHOLDER do chat da turma, usado só sem NEXT_PUBLIC_API_URL.
// No produto, a resposta vem do backend: um LLM recebe a pergunta, o histórico da conversa
// e os dados de desempenho da turma. Aqui só escolhemos textos prontos a partir de palavras-chave
// e de um retrato da turma fake, para a demonstração parecer real. Nada disso vai para produção.

export interface RetratoTurma {
  turma: string;
  habilidades: { id: string; nome: string; disciplina: string; alerta: string[]; atencao: string[] }[];
  evolucao: { aluno: string; variacao: number }[]; // média recente − média do início do bimestre
  semAtividade: string[]; // sem sessão nos últimos 7 dias
}

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const TEMAS: [RegExp, string][] = [
  [/fraca|fracoes|metade|terco|quarto/, "mat-fracoes"],
  [/multiplica|tabuada|vezes/, "mat-mult"],
  [/adicao|subtracao|soma|conta|reagrup|vai um/, "mat-adicao"],
  [/problema|enunciado/, "mat-problemas"],
  [/leitura|interpreta|compreens|texto/, "por-leitura"],
  [/ortografia|escrita|ditado|palavra/, "por-ortografia"],
  [/producao|redacao|frase completa/, "por-producao"],
  [/mapa|cardea|orienta|bussola/, "geo-orientacao"],
  [/paisagem|campo|cidade/, "geo-paisagem"],
  [/cadeia|animal|planta|seres vivos/, "cie-seres-vivos"],
  [/agua|materia|vapor|gelo/, "cie-materia"],
  [/cumpriment|dialogo|frases em ingles/, "ing-frases"],
  [/vocabul|ingles|cores/, "ing-vocabulario"],
];

const ATIVIDADES: Record<string, string> = {
  "mat-fracoes":
    "Pizza de papel (30 min)\n1. Cada dupla recebe 3 círculos de papel do mesmo tamanho.\n2. Dobram e recortam: um em 2, outro em 3, outro em 4 partes iguais.\n3. Comparam lado a lado: \"qual pedaço é maior, 1/3 ou 1/4?\" e registram no caderno.\n4. Fechamento: 4 perguntas rápidas no quadro (\"metade de 8 balas\", \"um quarto de 12\").\nDica: deixe que eles errem a comparação primeiro e confiram com os recortes.",
  "mat-mult":
    "Bingo da tabuada (25 min)\n1. Cada aluno monta uma cartela 3×3 com resultados da tabuada do 6 ao 9.\n2. Você sorteia as contas (\"7 × 8\") e eles marcam o resultado.\n3. Quem completa uma linha explica em voz alta uma das contas usando grupos (\"7 grupos de 8\").\nVariação para quem já domina: cartela com contas, sorteio com resultados.",
  "mat-adicao":
    "Contas no quadriculado (20 min)\n1. Contas de adição com reagrupamento montadas em papel quadriculado, unidades e dezenas em cores diferentes.\n2. A cada conta, o aluno diz em voz alta o que acontece quando as unidades passam de 9.\n3. Termine com 3 contas de subtração com empréstimo, no mesmo formato.",
  "mat-problemas":
    "Problemas sem números (25 min)\n1. Leia um problema trocando os números por \"alguns\" (\"Ana tinha algumas figurinhas e ganhou mais algumas\").\n2. A turma decide só a operação, sem calcular, e justifica.\n3. Depois os números voltam e eles resolvem.\nIsso separa a interpretação do cálculo, que é onde a turma tropeça.",
  "por-leitura":
    "Leitura com pausa (25 min)\n1. Texto curto (meia página) lido em voz alta, com 3 pausas combinadas.\n2. Em cada pausa: \"o que aconteceu até aqui?\" e \"o que vai acontecer?\".\n3. No fim, cada aluno escreve em uma frase a ideia principal e compara com a do colega.",
  "por-ortografia":
    "Caderno das palavras que enganam (20 min)\n1. Ditado curto com 10 palavras do dia a dia com s, ss e ç.\n2. Cada aluno corrige com a lista no quadro e copia as que errou no caderno das palavras que enganam.\n3. Em duplas, criam uma frase engraçada com duas dessas palavras.",
  "geo-orientacao":
    "Caça ao tesouro no pátio (30 min)\n1. Marque Norte, Sul, Leste e Oeste no pátio com giz.\n2. Grupos recebem pistas (\"10 passos para o Leste, depois 5 para o Norte\").\n3. De volta à sala, desenham o caminho feito, com legenda.",
  "cie-seres-vivos":
    "Teia de quem come quem (25 min)\n1. Cartões com sol, capim, coelho, raposa, gavião, minhoca.\n2. Em grupos, montam a cadeia no chão ligando com barbante.\n3. Pergunta-chave: \"se o capim sumir, o que acontece com a raposa?\"",
};

const lista = (nomes: string[], max = 4) =>
  nomes.length <= max ? nomes.join(", ") : `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}`;

function ranking(r: RetratoTurma) {
  return [...r.habilidades]
    .map((h) => ({ ...h, peso: h.alerta.length * 2 + h.atencao.length }))
    .filter((h) => h.peso > 0)
    .sort((a, b) => b.peso - a.peso);
}

function dificuldades(r: RetratoTurma) {
  const top = ranking(r).slice(0, 3);
  if (top.length === 0) return `Nenhuma habilidade do ${r.turma} está em alerta ou atenção agora. Bom momento para avançar o conteúdo.`;
  const linhas = top.map(
    (h, i) =>
      `${i + 1}. ${h.nome} (${h.disciplina}): ${h.alerta.length} em alerta, ${h.atencao.length} em atenção` +
      (h.alerta.length ? ` (${lista(h.alerta)})` : ""),
  );
  return [
    `Onde o ${r.turma} está com mais dificuldade agora:`,
    "",
    ...linhas,
    "",
    `${top[0].nome} concentra o maior grupo. Se for escolher um foco para a semana, eu começaria por ela — posso sugerir uma atividade de reforço.`,
  ].join("\n");
}

function atividade(r: RetratoTurma, habilidadeId?: string) {
  const h = r.habilidades.find((x) => x.id === habilidadeId) ?? ranking(r)[0] ?? r.habilidades[0];
  if (!h) return "Não há habilidades ativas na turma para sugerir uma atividade.";
  const plano =
    ATIVIDADES[h.id] ??
    `Atividade de reforço de ${h.nome.toLowerCase()} (25 min)\n1. Retome o conceito com um exemplo do cotidiano.\n2. Duplas resolvem 4 questões curtas, do mais fácil ao mais difícil.\n3. Cada dupla explica uma resposta para a turma.`;
  const grupo = [...h.alerta, ...h.atencao];
  return [
    `Sugestão para ${h.nome} (${h.disciplina}):`,
    "",
    plano,
    "",
    grupo.length
      ? `Vale acompanhar de perto: ${lista(grupo, 6)} — coloque cada um em dupla com alguém que já domina a habilidade.`
      : "Ninguém da turma está em alerta nessa habilidade; a atividade funciona como revisão.",
  ].join("\n");
}

function alunos(r: RetratoTurma) {
  const contagem = new Map<string, number>();
  for (const h of r.habilidades) for (const a of h.alerta) contagem.set(a, (contagem.get(a) ?? 0) + 1);
  const ordem = [...contagem].sort((a, b) => b[1] - a[1]);
  if (ordem.length === 0) return "Nenhum aluno com habilidade em alerta no momento.";
  return [
    "Alunos que pedem mais atenção agora:",
    "",
    ...ordem.map(([nome, n]) => `• ${nome}: ${n} ${n === 1 ? "habilidade" : "habilidades"} em alerta`),
    ...(r.semAtividade.length ? ["", `Sem atividade nos últimos 7 dias: ${lista(r.semAtividade, 6)}`] : []),
    "",
    "Os detalhes e as recomendações de cada um estão na página do aluno.",
  ].join("\n");
}

function evolucao(r: RetratoTurma) {
  const subiram = r.evolucao.filter((e) => e.variacao >= 5).sort((a, b) => b.variacao - a.variacao);
  const cairam = r.evolucao.filter((e) => e.variacao <= -5).sort((a, b) => a.variacao - b.variacao);
  return [
    "Comparando o início do bimestre com as últimas atividades:",
    "",
    subiram.length ? `Avançaram: ${subiram.slice(0, 4).map((e) => `${e.aluno} (+${e.variacao})`).join(", ")}.` : "Ninguém avançou de forma clara ainda.",
    cairam.length ? `Recuaram: ${cairam.slice(0, 4).map((e) => `${e.aluno} (${e.variacao})`).join(", ")}.` : "Ninguém recuou de forma relevante.",
    "",
    "Os números são a variação média de desempenho (0 a 100) nas habilidades ativas.",
  ].join("\n");
}

function geral(r: RetratoTurma) {
  const top = ranking(r)[0];
  const emAlerta = new Set(r.habilidades.flatMap((h) => h.alerta)).size;
  return [
    `Resumo do ${r.turma}: ${emAlerta} ${emAlerta === 1 ? "aluno tem" : "alunos têm"} ao menos uma habilidade em alerta.`,
    top ? `O ponto mais sensível é ${top.nome} (${top.disciplina}).` : "Nenhuma habilidade concentra dificuldades.",
    "",
    "Posso ajudar com perguntas como:",
    "• Onde a turma está com mais dificuldade?",
    "• Me dá uma atividade de reforço de frações para amanhã",
    "• Quem precisa de mais atenção?",
    "• Quem evoluiu neste bimestre?",
  ].join("\n");
}

export function responderChat(pergunta: string, r: RetratoTurma): string {
  const p = normalizar(pergunta);
  const tema = TEMAS.find(([re]) => re.test(p))?.[1];
  if (/atividade|reforco|exercicio|plano|aula|amanha|dinamica|jogo|sugest/.test(p)) return atividade(r, tema);
  if (/evolu|melhor|progress|avanc|cresce|recu|pior(ou|aram)/.test(p)) return evolucao(r);
  if (/quem|quais alunos|nomes|grupo|alunos/.test(p)) return alunos(r);
  if (/dificuldade|atencao|alerta|onde|pior|fraco|errando|semana/.test(p)) return dificuldades(r);
  if (tema) return atividade(r, tema);
  return geral(r);
}
