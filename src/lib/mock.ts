// Respostas de exemplo usadas apenas enquanto NEXT_PUBLIC_API_URL não está definida.
// Simula o backend para desenvolver a interface — não é lógica de produção.
import { estadoInicialAdaptacao, NIVEIS, registrarResposta } from "./adaptacao";
import { ApiError } from "./api";
import { BANCO, type PerguntaBanco } from "./mock-perguntas";
import type {
  AlunoCadastro,
  AlunoDetalhe,
  AlunoResumo,
  EstadoAdaptacao,
  HabilidadeStatus,
  HistoricoHabilidade,
  Nivel,
  PedidoPin,
  PedidoSessao,
  PedidoTurmaConfig,
  Pergunta,
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
  { id: "geo-orientacao", nome: "Orientação e mapas", disciplina: "Geografia", descricao: "Pontos cardeais, legenda e escala em mapas simples." },
  { id: "geo-paisagem", nome: "Paisagem e lugar", disciplina: "Geografia", descricao: "Elementos naturais e construídos; campo e cidade." },
  { id: "cie-seres-vivos", nome: "Seres vivos", disciplina: "Ciências", descricao: "Características de plantas e animais e cadeias alimentares." },
  { id: "cie-materia", nome: "Água e materiais", disciplina: "Ciências", descricao: "Estados físicos da água e propriedades dos materiais." },
  { id: "ing-vocabulario", nome: "Vocabulário", disciplina: "Inglês", descricao: "Cores, números, animais e alimentos." },
  { id: "ing-frases", nome: "Frases do dia a dia", disciplina: "Inglês", descricao: "Cumprimentos e perguntas simples sobre si mesmo." },
];

// Ordem em que as disciplinas aparecem para o aluno
const DISCIPLINAS = [
  { id: "por", nome: "Português" },
  { id: "mat", nome: "Matemática" },
  { id: "geo", nome: "Geografia" },
  { id: "cie", nome: "Ciências" },
  { id: "ing", nome: "Inglês" },
];
const nomeDisciplina = (id: string) => DISCIPLINAS.find((d) => d.id === id)?.nome;

// Estado mutável do mock. Fica em globalThis para que o route handler /api/mock
// (chamadas do navegador) e os Server Components vejam os mesmos dados.
interface SessaoMock {
  acertos: number;
  alunoId: string;
  total: number;
  habilidades: string[];
  usadas: Set<string>;
  adaptacao: EstadoAdaptacao;
  respostas: { perguntaId: string; habilidadeId: string; nivel: Nivel; correta: boolean }[];
  concluida?: boolean;
}

// Uma linha por sessão concluída: desempenho (0–100) em cada habilidade trabalhada.
// O histórico só cresce — nenhuma sessão sobrescreve a anterior.
interface RegistroSessao {
  data: string;
  desempenho: Record<string, number>;
}

interface EstadoMock {
  registros: Map<string, RegistroSessao[]>; // alunoId -> sessões, em ordem
  statusAtual: Map<string, Status>; // "alunoId:habilidadeId" -> status recalculado após sessões novas
  ultimaAtividade: Map<string, string>; // alunoId -> data da última sessão feita na demo
  ativas: Set<string>;
  disciplinasAtivas: Set<string>;
  sessoes: Map<string, SessaoMock>;
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
    registros: new Map(),
    statusAtual: new Map(),
    ultimaAtividade: new Map(),
    ativas: new Set(HABILIDADES.filter((h) => h.id !== "por-producao").map((h) => h.id)),
    disciplinasAtivas: new Set(DISCIPLINAS.map((d) => d.id)),
    sessoes: new Map(),
    pins: new Map(Object.entries(PINS_INICIAIS)),
    acessos: new Map(),
    tentativas: new Map(),
  };
}

// Suba VERSAO ao mudar o formato ou os dados iniciais: em dev, o estado antigo é descartado.
const VERSAO = 5;
const g = globalThis as typeof globalThis & { __trilhaMock?: EstadoMock & { versao: number } };
if (g.__trilhaMock?.versao !== VERSAO) g.__trilhaMock = { ...estadoInicial(), versao: VERSAO };
const estado: EstadoMock = g.__trilhaMock;

// Status por aluno, na ordem de HABILIDADES (o: ok, a: atenção, x: alerta),
// agrupados por disciplina: Matemática + Português + Geografia + Ciências + Inglês
const ALUNOS: { id: string; nome: string; ultima: string | null; status: string }[] = [
  { id: "a1", nome: "Ana Clara Souza", ultima: "2026-10-13", status: "ooao" + "oao" + "oa" + "oo" + "oo" },
  { id: "a2", nome: "Bruno Ferreira", ultima: "2026-10-13", status: "oaxx" + "ooo" + "oo" + "ao" + "ao" },
  { id: "a3", nome: "Caio Nascimento", ultima: "2026-10-10", status: "oooo" + "ooo" + "oo" + "oo" + "oo" },
  { id: "a4", nome: "Daniela Rocha", ultima: "2026-10-12", status: "oooa" + "xao" + "ao" + "oo" + "ox" },
  { id: "a5", nome: "Enzo Martins", ultima: "2026-10-13", status: "aaoa" + "ooo" + "oo" + "xo" + "oo" },
  { id: "a6", nome: "Fernanda Lima", ultima: "2026-10-09", status: "oooo" + "oao" + "oo" + "oa" + "oo" },
  { id: "a7", nome: "Gabriel Alves", ultima: null, status: "oooo" + "ooo" + "oo" + "oo" + "oo" },
  { id: "a8", nome: "Helena Costa", ultima: "2026-10-11", status: "xaox" + "oao" + "ao" + "oa" + "oo" },
  { id: "a9", nome: "Isadora Pereira", ultima: "2026-10-13", status: "oooo" + "oao" + "oo" + "oo" + "oa" },
  { id: "a10", nome: "João Pedro Dias", ultima: "2026-10-12", status: "ooao" + "oxo" + "xo" + "oo" + "oo" },
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
  "geo-orientacao":
    "Os pontos cardeais ainda são decorados, mas não usados: a criança acerta \"onde o sol nasce\" e erra quando precisa se orientar a partir do próprio corpo. Brincadeiras de caça ao tesouro no pátio, com pistas do tipo \"dez passos para o norte\", e desenhar o caminho de casa até a escola ajudam a transformar a regra em referência.",
  "geo-paisagem":
    "Distingue bem o natural do construído, mas ainda não relaciona as mudanças na paisagem com as consequências. Comparar duas fotos do mesmo lugar em épocas diferentes e perguntar \"o que mudou e o que isso causou?\" é um bom exercício.",
  "cie-seres-vivos":
    "Reconhece os seres vivos, mas a cadeia alimentar ainda é confusa: inverte quem come quem. Montar a cadeia com cartões recortados (sol → planta → animal) e brincar de \"quem depende de quem\" costuma resolver em poucas semanas.",
  "cie-materia":
    "Os estados físicos da água estão claros no gelo e no vapor, mas a condensação ainda não. Um copo de água gelada na mesa da sala e a pergunta \"de onde vieram essas gotinhas?\" rendem uma boa conversa de cinco minutos.",
  "ing-vocabulario":
    "O vocabulário de cores e animais está consolidado; números acima de dez ainda geram dúvida. Cantar a contagem em inglês durante rotinas (fila, organização da sala) ajuda sem tomar tempo de aula.",
  "ing-frases":
    "Entende cumprimentos, mas ainda não reconhece perguntas sobre si mesmo (\"How old are you?\"). Diálogos curtos em dupla, com as mesmas três perguntas toda semana, criam a segurança para responder sem traduzir.",
};

// `alunoId` aplica o status recalculado pelas sessões feitas na demo, quando houver.
function habilidadesDe(status: string, alunoId?: string): HabilidadeStatus[] {
  const disciplinasAtivas = new Set(DISCIPLINAS.filter((d) => estado.disciplinasAtivas.has(d.id)).map((d) => d.nome));
  return HABILIDADES.map((h, i) => ({
    habilidadeId: h.id,
    nome: h.nome,
    disciplina: h.disciplina,
    status: estado.statusAtual.get(`${alunoId}:${h.id}`) ?? STATUS[status[i]],
  })).filter((h) => estado.ativas.has(h.habilidadeId) && disciplinasAtivas.has(h.disciplina));
}

const ultimaDe = (a: (typeof ALUNOS)[number]) => estado.ultimaAtividade.get(a.id) ?? a.ultima;

function resumo(a: (typeof ALUNOS)[number]): AlunoResumo {
  return { id: a.id, nome: a.nome, turma: TURMA.nome, ultimaAtividade: ultimaDe(a), habilidades: habilidadesDe(a.status, a.id) };
}

function detalhe(a: (typeof ALUNOS)[number]): AlunoDetalhe {
  const habilidades = habilidadesDe(a.status, a.id);
  const recomendacoes: Recomendacao[] = habilidades
    .filter((h) => h.status === "alerta" || (h.status === "atencao" && TEXTOS[h.habilidadeId]))
    .map((h) => ({
      habilidadeId: h.habilidadeId,
      habilidade: h.nome,
      status: h.status,
      texto: TEXTOS[h.habilidadeId] ?? "Recomendação em preparação.",
      geradaEm: ultimaDe(a) ?? "2026-10-13",
    }));
  return { ...resumo(a), recomendacoes };
}

/**
 * Sessões de exemplo anteriores à demo, coerentes com o status de cada habilidade.
 * Bruno (a2) é o aluno de exemplo com sessões mais frequentes (duas por semana).
 */
function sessoesIniciais(a: (typeof ALUNOS)[number]): RegistroSessao[] {
  if (!a.ultima) return []; // quem nunca fez atividade não tem histórico
  const datas: string[] = [];
  const passo = a.id === "a2" ? [3, 4] : [7];
  for (let d = new Date("2026-08-24T00:00:00Z"), i = 0; d <= new Date(`${a.ultima}T00:00:00Z`); i++) {
    datas.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + passo[i % passo.length] * 86_400_000);
  }
  const alvo: Record<Status, number> = { ok: 82, atencao: 61, alerta: 42 };
  return datas.map((data, i) => {
    const t = i / Math.max(datas.length - 1, 1);
    const desempenho: Record<string, number> = {};
    HABILIDADES.forEach((h, hi) => {
      const status = STATUS[a.status[hi]];
      const inicio = status === "ok" ? 58 + (hi % 3) * 6 : status === "atencao" ? 55 : 60;
      const ruido = ((hi * 7 + i * 13) % 9) - 4;
      desempenho[h.id] = Math.max(0, Math.min(100, Math.round(inicio + (alvo[status] - inicio) * t + ruido)));
    });
    return { data, desempenho };
  });
}

function registrosDe(a: (typeof ALUNOS)[number]) {
  let r = estado.registros.get(a.id);
  if (!r) estado.registros.set(a.id, (r = sessoesIniciais(a)));
  return r;
}

/** Série de uma habilidade: todas as sessões, uma por dia (média quando houve mais de uma no mesmo dia). */
function serie(a: (typeof ALUNOS)[number], habilidadeId: string) {
  const porDia = new Map<string, number[]>();
  for (const r of registrosDe(a)) {
    const v = r.desempenho[habilidadeId];
    if (v !== undefined) porDia.set(r.data, [...(porDia.get(r.data) ?? []), v]);
  }
  return [...porDia]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([data, vs]) => ({ data, desempenho: Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) }));
}

function historico(a: (typeof ALUNOS)[number]): HistoricoHabilidade[] {
  return habilidadesDe(a.status, a.id).map((h) => ({
    habilidadeId: h.habilidadeId,
    nome: h.nome,
    disciplina: h.disciplina,
    pontos: serie(a, h.habilidadeId),
  }));
}

// Pontuação de exemplo por resposta: acertar uma difícil vale mais; errar uma difícil pesa menos.
const PONTOS_RESPOSTA: Record<Nivel, { certa: number; errada: number }> = {
  facil: { certa: 60, errada: 0 },
  medio: { certa: 80, errada: 20 },
  dificil: { certa: 100, errada: 40 },
};

/** Acrescenta a sessão concluída ao histórico do aluno e recalcula o status das habilidades tocadas. */
function registrarSessao(s: SessaoMock) {
  const aluno = ALUNOS.find((a) => a.id === s.alunoId);
  if (!aluno || s.respostas.length === 0) return;
  const hoje = new Date().toISOString().slice(0, 10);

  const pontos = new Map<string, number[]>();
  for (const r of s.respostas) {
    const p = PONTOS_RESPOSTA[r.nivel][r.correta ? "certa" : "errada"];
    pontos.set(r.habilidadeId, [...(pontos.get(r.habilidadeId) ?? []), p]);
  }
  const desempenho = Object.fromEntries(
    [...pontos].map(([id, ps]) => [id, Math.round(ps.reduce((a, b) => a + b, 0) / ps.length)]),
  );
  registrosDe(aluno).push({ data: hoje, desempenho });
  estado.ultimaAtividade.set(aluno.id, hoje);

  // Status = média dos 3 últimos dias com atividade na habilidade
  for (const id of pontos.keys()) {
    const ultimos = serie(aluno, id).slice(-3);
    const media = ultimos.reduce((s, p) => s + p.desempenho, 0) / ultimos.length;
    estado.statusAtual.set(`${aluno.id}:${id}`, media >= 70 ? "ok" : media >= 55 ? "atencao" : "alerta");
  }
}

function config(): TurmaConfig {
  // Ordem do painel: Matemática e Português primeiro, como já era, depois as demais
  const ordem = ["mat", "por", "geo", "cie", "ing"];
  const disciplinas = ordem.map((id) => nomeDisciplina(id)!).map((nome, i) => ({
    id: ordem[i],
    nome,
    ativa: estado.disciplinasAtivas.has(ordem[i]),
    habilidades: HABILIDADES.filter((h) => h.disciplina === nome).map((h) => ({
      id: h.id,
      nome: h.nome,
      descricao: h.descricao,
      ativa: estado.ativas.has(h.id),
    })),
  }));
  return { turma: TURMA, ciclo: "4º bimestre de 2026", disciplinas };
}

const PERGUNTAS_POR_SESSAO = 6;

/** Habilidades que entram numa sessão: ativas, de disciplina ativa e (se pedida) da disciplina escolhida. */
function habilidadesDaSessao(disciplinaId?: string) {
  return HABILIDADES.filter((h) => {
    const disc = DISCIPLINAS.find((d) => d.nome === h.disciplina)!;
    return (
      estado.ativas.has(h.id) &&
      estado.disciplinasAtivas.has(disc.id) &&
      (!disciplinaId || disc.id === disciplinaId) &&
      BANCO.some((p) => p.habilidadeId === h.id)
    );
  }).map((h) => h.id);
}

/**
 * Próxima pergunta não usada: de preferência no nível pedido e na habilidade da vez
 * (as habilidades se revezam); se faltar, a de nível mais próximo.
 */
function escolherPergunta(habilidades: string[], nivel: Nivel, usadas: Set<string>, vez: number) {
  const alvo = habilidades[vez % habilidades.length];
  const custo = (p: PerguntaBanco) =>
    Math.abs(NIVEIS.indexOf(p.nivel) - NIVEIS.indexOf(nivel)) * 10 + (p.habilidadeId === alvo ? 0 : 1) + Math.random() * 0.5;
  return BANCO.filter((p) => habilidades.includes(p.habilidadeId) && !usadas.has(p.id))
    .map((p) => ({ p, c: custo(p) }))
    .sort((a, b) => a.c - b.c)[0]?.p;
}

function paraCliente(p: PerguntaBanco): Pergunta {
  return {
    id: p.id,
    disciplina: HABILIDADES.find((h) => h.id === p.habilidadeId)!.disciplina,
    habilidadeId: p.habilidadeId,
    nivel: p.nivel,
    enunciado: p.enunciado,
    apoio: p.apoio,
    opcoes: p.opcoes.map((texto, i) => ({ id: `${p.id}-${i}`, texto })),
  };
}

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
    if (method === "PUT") {
      const pedido = body as PedidoTurmaConfig;
      estado.ativas = new Set(pedido.habilidadesAtivas);
      if (pedido.disciplinasAtivas) estado.disciplinasAtivas = new Set(pedido.disciplinasAtivas);
    }
    return config();
  }

  if (partes[0] === "turmas" && partes[1]) {
    if (partes[1].toUpperCase() !== TURMA.codigo) throw new ApiError(404, "Turma não encontrada");
    const publica: TurmaPublica = {
      codigo: TURMA.codigo,
      nome: TURMA.nome,
      alunos: ALUNOS.map((a) => ({ id: a.id, nome: a.nome.split(" ")[0] + " " + a.nome.split(" ").at(-1)![0] + "." })),
      disciplinas: DISCIPLINAS.filter((d) => habilidadesDaSessao(d.id).length > 0),
    };
    return publica;
  }

  if (path === "/sessoes" && method === "POST") {
    const pedido = body as PedidoSessao;
    // Sem a credencial do PIN, ninguém abre sessão em nome de outro aluno.
    if (!pedido.acesso || estado.acessos.get(pedido.acesso) !== pedido.alunoId) {
      throw new ApiError(401, "Confirme o PIN do aluno antes de começar");
    }
    const habilidades = habilidadesDaSessao(pedido.disciplinaId);
    if (habilidades.length === 0) throw new ApiError(404, "Nenhuma habilidade ativa nesta disciplina");

    // A lista sai toda no nível inicial; a partir da 2ª, cada resposta traz a `proxima`
    // no nível ajustado, que substitui a da lista. Só a 1ª conta como usada agora.
    const adaptacao = estadoInicialAdaptacao();
    const reservadas = new Set<string>();
    const perguntas: PerguntaBanco[] = [];
    for (let i = 0; i < PERGUNTAS_POR_SESSAO; i++) {
      const p = escolherPergunta(habilidades, adaptacao.nivel, reservadas, i);
      if (!p) break;
      reservadas.add(p.id);
      perguntas.push(p);
    }

    const sessaoId = `s${Date.now()}`;
    estado.sessoes.set(sessaoId, {
      acertos: 0,
      alunoId: pedido.alunoId,
      total: perguntas.length,
      habilidades,
      usadas: new Set([perguntas[0].id]),
      adaptacao,
      respostas: [],
    });
    const sessao: Sessao = { sessaoId, perguntas: perguntas.map(paraCliente) };
    return sessao;
  }

  if (partes[0] === "sessoes" && partes[2] === "respostas") {
    const { perguntaId, opcaoId } = body as { perguntaId: string; opcaoId: string };
    const p = BANCO.find((q) => q.id === perguntaId);
    if (!p) throw new ApiError(404, "Pergunta não encontrada");
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
    if (s && !s.respostas.some((q) => q.perguntaId === p.id)) {
      s.usadas.add(p.id);
      s.respostas.push({ perguntaId: p.id, habilidadeId: p.habilidadeId, nivel: p.nivel, correta });
      s.adaptacao = registrarResposta(s.adaptacao, correta);
      if (s.respostas.length < s.total) {
        const proxima = escolherPergunta(s.habilidades, s.adaptacao.nivel, s.usadas, s.respostas.length);
        if (proxima) {
          s.usadas.add(proxima.id);
          r.proxima = paraCliente(proxima);
        }
      }
    }
    return r;
  }

  if (partes[0] === "sessoes" && partes[2] === "concluir") {
    const s = estado.sessoes.get(partes[1]);
    if (s && !s.concluida) {
      s.concluida = true;
      registrarSessao(s);
    }
    const acertos = s?.acertos ?? 0;
    const total = s?.total ?? PERGUNTAS_POR_SESSAO;
    const r: ResultadoSessao = {
      estrelas: acertos,
      total,
      mensagem: acertos >= total - 1 ? "Você chegou ao fim da trilha voando!" : "Você chegou ao fim da trilha!",
    };
    return r;
  }

  throw new ApiError(404, `Rota de exemplo não encontrada: ${method} ${path}`);
}

export async function mockRequest<T>(path: string, method: string, body: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 150));
  return structuredClone(rotear(path, method, body)) as T;
}
