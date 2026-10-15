// Respostas de exemplo usadas apenas enquanto NEXT_PUBLIC_API_URL não está definida.
// Simula o backend para desenvolver a interface — não é lógica de produção.
import { ApiError } from "./api";
import type {
  AlunoCadastro,
  AlunoDetalhe,
  AlunoResumo,
  HabilidadeStatus,
  HistoricoHabilidade,
  PedidoPin,
  PedidoSessao,
  Recomendacao,
  ResultadoPin,
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

// Estado mutável do mock. Fica em globalThis para que o route handler /api/mock
// (chamadas do navegador) e os Server Components vejam os mesmos dados.
interface EstadoMock {
  ativas: Set<string>;
  sessoes: Map<string, { acertos: number; alunoId: string }>;
  pins: Map<string, string>; // alunoId -> PIN
  acessos: Map<string, string>; // credencial de acesso -> alunoId
  tentativas: Map<string, { erros: number; bloqueadoAte: number }>;
}

// PINs fake. Ana (a1) usa 1234; os demais aparecem em Painel > Turma.
const PINS_INICIAIS: Record<string, string> = {
  a1: "1234", a2: "2580", a3: "3141", a4: "4072", a5: "5319",
  a6: "6248", a7: "7105", a8: "8463", a9: "9026", a10: "1357",
};

function estadoInicial(): EstadoMock {
  return {
    ativas: new Set(HABILIDADES.filter((h) => h.id !== "por-producao").map((h) => h.id)),
    sessoes: new Map(),
    pins: new Map(Object.entries(PINS_INICIAIS)),
    acessos: new Map(),
    tentativas: new Map(),
  };
}

// O spread preserva o que já existe e completa campos novos quando o arquivo muda em dev.
const g = globalThis as typeof globalThis & { __trilhaMock?: EstadoMock };
const estado: EstadoMock = (g.__trilhaMock = { ...estadoInicial(), ...g.__trilhaMock });

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
  })).filter((h) => estado.ativas.has(h.habilidadeId));
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
      ativa: estado.ativas.has(h.id),
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

const ELOGIOS = ["Isso aí!", "Mandou bem!", "Acertou!", "Muito bem!"];

const cadastro = (a: (typeof ALUNOS)[number]): AlunoCadastro => ({ id: a.id, nome: a.nome, pin: estado.pins.get(a.id)! });

function novoPin(anterior?: string) {
  let pin: string;
  do pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  while (pin === anterior || new Set(pin).size === 1); // evita repetir o anterior e 0000, 1111…
  return pin;
}

const MAX_ERROS_PIN = 5;
const ESPERA_BLOQUEIO_MS = 60_000;

function validarPin({ alunoId, pin }: PedidoPin): ResultadoPin {
  if (!ALUNOS.some((a) => a.id === alunoId)) throw new ApiError(404, "Aluno não encontrado");
  const t = estado.tentativas.get(alunoId) ?? { erros: 0, bloqueadoAte: 0 };
  if (t.bloqueadoAte > Date.now()) return { valido: false, acesso: null, bloqueado: true };

  if (estado.pins.get(alunoId) !== pin) {
    t.erros++;
    if (t.erros >= MAX_ERROS_PIN) Object.assign(t, { erros: 0, bloqueadoAte: Date.now() + ESPERA_BLOQUEIO_MS });
    estado.tentativas.set(alunoId, t);
    return { valido: false, acesso: null, bloqueado: t.bloqueadoAte > Date.now() };
  }

  estado.tentativas.delete(alunoId);
  const acesso = `acesso-${alunoId}-${crypto.randomUUID()}`;
  estado.acessos.set(acesso, alunoId);
  return { valido: true, acesso, bloqueado: false };
}

function rotear(path: string, method: string, body: unknown): unknown {
  const partes = path.split("/").filter(Boolean);

  if (path === "/acesso/pin" && method === "POST") return validarPin(body as PedidoPin);

  if (path === "/turma/alunos" && method === "GET") return ALUNOS.map(cadastro);

  if (partes[0] === "turma" && partes[1] === "alunos" && partes[3] === "pin" && method === "POST") {
    const aluno = ALUNOS.find((a) => a.id === partes[2]);
    if (!aluno) throw new ApiError(404, "Aluno não encontrado");
    estado.pins.set(aluno.id, novoPin(estado.pins.get(aluno.id)));
    estado.tentativas.delete(aluno.id);
    // O PIN antigo deixa de valer, inclusive para quem já tinha entrado com ele.
    for (const [acesso, alunoId] of estado.acessos) if (alunoId === aluno.id) estado.acessos.delete(acesso);
    return cadastro(aluno);
  }

  if (method === "GET" && path === "/alunos") return ALUNOS.map(resumo);

  if (partes[0] === "alunos" && partes[1]) {
    const aluno = ALUNOS.find((a) => a.id === partes[1]);
    if (!aluno) throw new ApiError(404, "Aluno não encontrado");
    return partes[2] === "historico" ? historico(aluno) : detalhe(aluno);
  }

  if (path === "/turma/configuracao") {
    if (method === "PUT") estado.ativas = new Set((body as { habilidadesAtivas: string[] }).habilidadesAtivas);
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
    const pedido = body as PedidoSessao;
    // Sem a credencial do PIN, ninguém abre sessão em nome de outro aluno.
    if (!pedido.acesso || estado.acessos.get(pedido.acesso) !== pedido.alunoId) {
      throw new ApiError(401, "Confirme o PIN do aluno antes de começar");
    }
    const sessaoId = `s${Date.now()}`;
    estado.sessoes.set(sessaoId, { acertos: 0, alunoId: pedido.alunoId });
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
    const s = estado.sessoes.get(partes[1]);
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
    const acertos = estado.sessoes.get(partes[1])?.acertos ?? 0;
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
