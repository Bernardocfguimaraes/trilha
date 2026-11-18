import type {
  AlunoCadastro,
  AlunoDetalhe,
  AlunoResumo,
  Exercicio,
  HistoricoHabilidade,
  MensagemChat,
  Nivel,
  PedidoChatTurma,
  PedidoExercicio,
  PedidoLogin,
  PedidoNovaTurma,
  PedidoPin,
  PedidoProgresso,
  PedidoSessao,
  PedidoTurmaConfig,
  ProgressoResponsavel,
  RespostaLogin,
  ResultadoPin,
  ResultadoResposta,
  ResultadoSessao,
  Status,
  Sessao,
  AnoDisponivel,
  DiagnosticoHabilidade,
  GruposTurma,
  MetricasModelo,
  TurmaConfig,
  TurmaResumo,
  TurmaPublica,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || undefined;
const API_INTERNA = process.env.API_INTERNAL_URL || undefined;

export const urlDaApiNoServidor = () => API_INTERNA ?? API_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Opcoes {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  token?: string | null;
  professor?: boolean;
}

const noNavegador = () => typeof window !== "undefined";

async function request<T>(path: string, { method = "GET", body, token, professor }: Opcoes = {}): Promise<T> {
  if (!API_URL && !noNavegador()) {
    const { mockRequest } = await import("./mock");
    return mockRequest<T>(path, method, body, token);
  }

  const base = noNavegador() ? (professor ? "/api/professor" : (API_URL ?? "/api/mock")) : urlDaApiNoServidor();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  }
  return res.json() as Promise<T>;
}

export const api = {
  entrar: (email: string, senha: string) =>
    request<RespostaLogin>("/auth/entrar", { method: "POST", body: { email, senha } satisfies PedidoLogin }),
  eu: (token: string) => request<{ nome: string; email: string }>("/auth/eu", { token }),

  turmas: (token?: string | null) => request<TurmaResumo[]>("/turmas", { token, professor: true }),
  anos: (token?: string | null) => request<AnoDisponivel[]>("/anos", { token, professor: true }),
  criarTurma: (pedido: PedidoNovaTurma) =>
    request<TurmaResumo>("/turmas", { method: "POST", body: pedido, professor: true }),
  adicionarAluno: (turmaId: string, nome: string) =>
    request<AlunoCadastro>(`/turmas/${turmaId}/alunos`, { method: "POST", body: { nome }, professor: true }),

  alunos: (turmaId: string, token?: string | null) =>
    request<AlunoResumo[]>(`/turmas/${turmaId}/alunos`, { token, professor: true }),
  aluno: (id: string, token?: string | null) =>
    request<AlunoDetalhe>(`/alunos/${id}`, { token, professor: true }),
  historico: (id: string, token?: string | null) =>
    request<HistoricoHabilidade[]>(`/alunos/${id}/historico`, { token, professor: true }),
  diagnosticoAluno: (id: string, token?: string | null) =>
    request<DiagnosticoHabilidade[]>(`/alunos/${id}/diagnostico`, { token, professor: true }),
  avaliarDiagnostico: (alunoId: string, habilidadeId: string, status: Status) =>
    request<{ habilidadeId: string; avaliacaoProfessor: Status; statusModelo: Status }>(
      `/alunos/${alunoId}/diagnostico/${encodeURIComponent(habilidadeId)}`,
      { method: "PUT", body: { status }, professor: true },
    ),
  gruposTurma: (turmaId: string, token?: string | null) =>
    request<GruposTurma>(`/turmas/${turmaId}/grupos`, { token, professor: true }),
  metricasModelo: (token?: string | null) => request<MetricasModelo>("/modelo", { token, professor: true }),
  reavaliarTurma: (turmaId: string) =>
    request<{ reavaliados: number; modelo: "ml" | "regra" }>(`/turmas/${turmaId}/diagnostico`, { method: "POST", professor: true }),
  turmaConfig: (turmaId: string, token?: string | null) =>
    request<TurmaConfig>(`/turmas/${turmaId}/configuracao`, { token, professor: true }),
  salvarTurmaConfig: (turmaId: string, habilidadesAtivas: string[], disciplinasAtivas?: string[]) =>
    request<TurmaConfig>(`/turmas/${turmaId}/configuracao`, {
      method: "PUT",
      body: { habilidadesAtivas, disciplinasAtivas } satisfies PedidoTurmaConfig,
      professor: true,
    }),

  chatTurma: (turmaId: string, pergunta: string, historico: MensagemChat[] = []) =>
    request<MensagemChat>(`/turmas/${encodeURIComponent(turmaId)}/chat`, {
      method: "POST",
      body: { pergunta, historico } satisfies PedidoChatTurma,
      professor: true,
    }),
  gerarExercicio: (habilidadeId: string, nivel: Nivel = "facil", evitar: string[] = []) =>
    request<Exercicio>("/exercicios/gerar", {
      method: "POST",
      body: { habilidadeId, nivel, evitar } satisfies PedidoExercicio,
      professor: true,
    }),

  transcrever: async (audio: Blob): Promise<{ texto: string }> => {
    const form = new FormData();
    form.append("audio", audio, "audio.webm");
    const res = await fetch("/api/professor/voz/transcrever", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
    return res.json() as Promise<{ texto: string }>;
  },
  alunosTurma: (turmaId: string, token?: string | null) =>
    request<AlunoCadastro[]>(`/turmas/${turmaId}/cadastros`, { token, professor: true }),
  regenerarPin: (alunoId: string) =>
    request<AlunoCadastro>(`/alunos/${alunoId}/pin`, { method: "POST", professor: true }),

  turmaPublica: (codigo: string) =>
    request<TurmaPublica>(`/turmas/${encodeURIComponent(codigo)}`),
  validarPin: (alunoId: string, pin: string) =>
    request<ResultadoPin>("/acesso/pin", { method: "POST", body: { alunoId, pin } satisfies PedidoPin }),
  iniciarSessao: (codigo: string, alunoId: string, opcoes: Omit<PedidoSessao, "codigo" | "alunoId"> = {}) =>
    request<Sessao>("/sessoes", { method: "POST", body: { codigo, alunoId, ...opcoes } satisfies PedidoSessao }),
  responder: (sessaoId: string, perguntaId: string, opcaoId: string) =>
    request<ResultadoResposta>(`/sessoes/${sessaoId}/respostas`, {
      method: "POST",
      body: { perguntaId, opcaoId },
    }),
  concluirSessao: (sessaoId: string) =>
    request<ResultadoSessao>(`/sessoes/${sessaoId}/concluir`, { method: "POST" }),

  progressoResponsavel: (acesso: string) =>
    request<ProgressoResponsavel>("/responsavel/progresso", {
      method: "POST",
      body: { acesso } satisfies PedidoProgresso,
    }),
};
