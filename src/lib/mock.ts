// Respostas de exemplo usadas apenas enquanto NEXT_PUBLIC_API_URL não está definida.
// Simula o backend para desenvolver a interface — não é lógica de produção.
import { ApiError } from "./api";
import type {
  AlunoDetalhe,
  AlunoResumo,
  HabilidadeStatus,
  HistoricoHabilidade,
  Recomendacao,
  ResultadoResposta,
  ResultadoSessao,
  Sessao,
  Status,
  TurmaConfig,
  TurmaPublica,
} from "./types";

const TURMA = { id: "t1", nome: "4º ano B", codigo: "SABIA4" };

const HABILIDADES = [
  { id: "mat-adicao", nome: "Adição e subtração", disciplina: "Matemática", descricao: "Cálculos com números até 1.000, com e sem reagrupamento." },
  { id: "mat-mult", nome: "Multiplicação", disciplina: "Matemática", descricao: "Tabuada e multiplicação por um algarismo." },
  { id: "mat-fracoes", nome: "Frações simples", disciplina: "Matemática", descricao: "Metade, terço e quarto em situações do dia a dia." },
  { id: "mat-problemas", nome: "Resolução de problemas", disciplina: "Matemática", descricao: "Interpretar o enunciado e escolher a operação." },
  { id: "por-leitura", nome: "Leitura e compreensão", disciplina: "Português", descricao: "Localizar informações e entender a ideia principal de um texto curto." },
  { id: "por-ortografia", nome: "Ortografia", disciplina: "Português", descricao: "Uso de s/ss/ç, r/rr e acentuação de palavras comuns." },
  { id: "por-producao", nome: "Produção de texto", disciplina: "Português", descricao: "Escrever frases completas com início, meio e fim." },
];

let ativas = new Set(HABILIDADES.filter((h) => h.id !== "por-producao").map((h) => h.id));

// Status por aluno, na ordem de HABILIDADES (o: ok, a: atenção, x: alerta)
const ALUNOS: { id: string; nome: string; ultima: string | null; status: string }[] = [
  { id: "a1", nome: "Ana Clara Souza", ultima: "2026-10-13", status: "ooaooao" },
  { id: "a2", nome: "Bruno Ferreira", ultima: "2026-10-13", status: "oaxxooo" },
  { id: "a3", nome: "Caio Nascimento", ultima: "2026-10-10", status: "ooooooo" },
  { id: "a4", nome: "Daniela Rocha", ultima: "2026-10-12", status: "oooaxao" },
  { id: "a5", nome: "Enzo Martins", ultima: "2026-10-13", status: "aaoaooo" },
  { id: "a6", nome: "Fernanda Lima", ultima: "2026-10-09", status: "oooooao" },
  { id: "a7", nome: "Gabriel Alves", ultima: null, status: "ooooooo" },
  { id: "a8", nome: "Helena Costa", ultima: "2026-10-11", status: "xaoxoao" },
  { id: "a9", nome: "Isadora Pereira", ultima: "2026-10-13", status: "oooooao" },
  { id: "a10", nome: "João Pedro Dias", ultima: "2026-10-12", status: "ooaooxo" },
];

const STATUS: Record<string, Status> = { o: "ok", a: "atencao", x: "alerta" };

const TEXTOS: Record<string, string> = {
  "mat-adicao":
    "Nas últimas atividades, os erros aparecem quando a conta exige reagrupamento (\"vai um\"). Vale montar contas no papel quadriculado, separando dezenas e unidades por cor, e pedir que a criança explique em voz alta o que acontece quando a soma das unidades passa de 9. Dez minutos, três vezes por semana, costumam ser suficientes.",
  "mat-mult":
    "A tabuada do 6 ao 9 ainda está sendo resolvida por contagem nos dedos, o que deixa as respostas lentas e sujeitas a erro. Sugerimos jogos curtos de memorização (cartas, bingo de resultados) e relacionar multiplicação a grupos de objetos do cotidiano, como caixas de ovos.",
  "mat-fracoes":
    "A ideia de \"metade\" está consolidada, mas terço e quarto ainda são confundidos. Atividades com objetos reais — dividir uma pizza de papel, uma barra de chocolate — ajudam a ver que partes iguais ficam menores quando o número de partes aumenta.",
  "por-leitura":
    "A leitura está fluente, mas as respostas sobre a ideia principal do texto indicam que a compreensão ainda fica na superfície. Depois de cada leitura curta, peça que a criança conte a história com as próprias palavras e diga qual parte achou mais importante e por quê.",
  "por-ortografia":
    "Os erros se concentram em s, ss e ç. Um caderno de palavras \"que enganam\", montado pela própria criança, e ditados curtos com palavras do dia a dia ajudam a fixar o padrão sem transformar o treino em punição.",
};

function habilidadesDe(status: string): HabilidadeStatus[] {
  return HABILIDADES.map((h, i) => ({
    habilidadeId: h.id,
    nome: h.nome,
    disciplina: h.disciplina,
    status: STATUS[status[i]],
  })).filter((h) => ativas.has(h.habilidadeId));
}

function resumo(a: (typeof ALUNOS)[number]): AlunoResumo {
  return { id: a.id, nome: a.nome, turma: TURMA.nome, ultimaAtividade: a.ultima, habilidades: habilidadesDe(a.status) };
}

function detalhe(a: (typeof ALUNOS)[number]): AlunoDetalhe {
  const habilidades = habilidadesDe(a.status);
  const recomendacoes: Recomendacao[] = habilidades
    .filter((h) => h.status === "alerta" || (h.status === "atencao" && TEXTOS[h.habilidadeId]))
    .map((h) => ({
      habilidadeId: h.habilidadeId,
      habilidade: h.nome,
      status: h.status,
      texto: TEXTOS[h.habilidadeId] ?? "Recomendação em preparação.",
      geradaEm: a.ultima ?? "2026-10-13",
    }));
  return { ...resumo(a), recomendacoes };
}

function historico(a: (typeof ALUNOS)[number]): HistoricoHabilidade[] {
  const semanas = ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];
  const alvo: Record<Status, number> = { ok: 82, atencao: 61, alerta: 42 };
  return habilidadesDe(a.status).map((h, hi) => {
    const fim = alvo[h.status];
    const inicio = h.status === "ok" ? 58 + (hi % 3) * 6 : h.status === "atencao" ? 55 : 60;
    return {
      habilidadeId: h.habilidadeId,
      nome: h.nome,
      disciplina: h.disciplina,
      pontos: semanas.map((data, i) => {
        const t = i / (semanas.length - 1);
        const ruido = ((hi * 7 + i * 13) % 9) - 4;
        return { data, desempenho: Math.max(0, Math.min(100, Math.round(inicio + (fim - inicio) * t + ruido))) };
      }),
    };
  });
}

function config(): TurmaConfig {
  const disciplinas = ["Matemática", "Português"].map((nome) => ({
    id: nome === "Matemática" ? "mat" : "por",
    nome,
    habilidades: HABILIDADES.filter((h) => h.disciplina === nome).map((h) => ({
      id: h.id,
      nome: h.nome,
      descricao: h.descricao,
      ativa: ativas.has(h.id),
    })),
  }));
  return { turma: TURMA, ciclo: "4º bimestre de 2026", disciplinas };
}

const PERGUNTAS = [
  { id: "p1", disciplina: "Matemática", enunciado: "Quantas maçãs tem ao todo?", apoio: "🍎🍎🍎🍎🍎🍎🍎 + 🍎🍎🍎🍎🍎", opcoes: ["11", "12", "13", "10"], certa: 1 },
  { id: "p2", disciplina: "Português", enunciado: "Qual palavra está escrita certinho?", opcoes: ["cabeça", "cabessa", "cabesa", "cabeca"], certa: 0 },
  { id: "p3", disciplina: "Matemática", enunciado: "Lia tem 3 caixas com 4 lápis em cada uma. Quantos lápis ela tem?", apoio: "✏️✏️✏️✏️   ✏️✏️✏️✏️   ✏️✏️✏️✏️", opcoes: ["7", "10", "12", "16"], certa: 2 },
  { id: "p4", disciplina: "Português", enunciado: "\"O gato subiu no telhado porque viu um passarinho.\" Por que o gato subiu?", opcoes: ["Porque estava com frio", "Porque viu um passarinho", "Porque queria dormir", "Porque a porta fechou"], certa: 1 },
  { id: "p5", disciplina: "Matemática", enunciado: "Qual pedaço é a metade da pizza?", apoio: "🍕", opcoes: ["1 de 2 pedaços", "1 de 3 pedaços", "1 de 4 pedaços", "2 de 3 pedaços"], certa: 0 },
  { id: "p6", disciplina: "Matemática", enunciado: "Quanto é 45 − 18?", opcoes: ["33", "27", "23", "37"], certa: 1 },
];

const sessoes = new Map<string, { acertos: number }>();

const ELOGIOS = ["Isso aí!", "Mandou bem!", "Acertou!", "Muito bem!"];

function rotear(path: string, method: string, body: unknown): unknown {
  const partes = path.split("/").filter(Boolean);

  if (method === "GET" && path === "/alunos") return ALUNOS.map(resumo);

  if (partes[0] === "alunos" && partes[1]) {
    const aluno = ALUNOS.find((a) => a.id === partes[1]);
    if (!aluno) throw new ApiError(404, "Aluno não encontrado");
    return partes[2] === "historico" ? historico(aluno) : detalhe(aluno);
  }

  if (path === "/turma/configuracao") {
    if (method === "PUT") ativas = new Set((body as { habilidadesAtivas: string[] }).habilidadesAtivas);
    return config();
  }

  if (partes[0] === "turmas" && partes[1]) {
    if (partes[1].toUpperCase() !== TURMA.codigo) throw new ApiError(404, "Turma não encontrada");
    const publica: TurmaPublica = {
      codigo: TURMA.codigo,
      nome: TURMA.nome,
      alunos: ALUNOS.map((a) => ({ id: a.id, nome: a.nome.split(" ")[0] + " " + a.nome.split(" ").at(-1)![0] + "." })),
    };
    return publica;
  }

  if (path === "/sessoes" && method === "POST") {
    const sessaoId = `s${Date.now()}`;
    sessoes.set(sessaoId, { acertos: 0 });
    const sessao: Sessao = {
      sessaoId,
      perguntas: PERGUNTAS.map((p) => ({
        id: p.id,
        disciplina: p.disciplina,
        enunciado: p.enunciado,
        apoio: p.apoio,
        opcoes: p.opcoes.map((texto, i) => ({ id: `${p.id}-${i}`, texto })),
      })),
    };
    return sessao;
  }

  if (partes[0] === "sessoes" && partes[2] === "respostas") {
    const { perguntaId, opcaoId } = body as { perguntaId: string; opcaoId: string };
    const p = PERGUNTAS.find((q) => q.id === perguntaId)!;
    const certaId = `${p.id}-${p.certa}`;
    const correta = opcaoId === certaId;
    const s = sessoes.get(partes[1]);
    if (s && correta) s.acertos++;
    const r: ResultadoResposta = {
      correta,
      opcaoCorretaId: certaId,
      mensagem: correta
        ? ELOGIOS[Math.floor(Math.random() * ELOGIOS.length)]
        : `Quase! A resposta é ${p.opcoes[p.certa]}.`,
    };
    return r;
  }

  if (partes[0] === "sessoes" && partes[2] === "concluir") {
    const acertos = sessoes.get(partes[1])?.acertos ?? 0;
    const r: ResultadoSessao = {
      estrelas: acertos,
      total: PERGUNTAS.length,
      mensagem: acertos >= 5 ? "Você chegou ao fim da trilha voando!" : "Você chegou ao fim da trilha!",
    };
    return r;
  }

  throw new ApiError(404, `Rota de exemplo não encontrada: ${method} ${path}`);
}

export async function mockRequest<T>(path: string, method: string, body: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 150));
  return structuredClone(rotear(path, method, body)) as T;
}
