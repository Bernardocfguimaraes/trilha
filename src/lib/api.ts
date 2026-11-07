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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  /** Token do professor (só no servidor; vem do cookie httpOnly). */
  token?: string | null;
  /** Rota do painel: no navegador passa pela ponte /api/professor, que anexa o token. */
  professor?: boolean;
}

const noNavegador = () => typeof window !== "undefined";

async function request<T>(path: string, { method = "GET", body, token, professor }: Opcoes = {}): Promise<T> {
  // Sem NEXT_PUBLIC_API_URL, usamos respostas de exemplo para desenvolver a interface.
  // No servidor o mock roda direto; no navegador ele passa por /api/mock, para que
  // painel e aluno enxerguem o mesmo estado (config salva, sessões, PINs).
  if (!API_URL && !noNavegador()) {
    const { mockRequest } = await import("./mock");
    return mockRequest<T>(path, method, body, token);
  }

  const base = noNavegador() && professor ? "/api/professor" : (API_URL ?? "/api/mock");
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
  // Login do professor (chamado só pelo servidor do Next; ver src/lib/auth.ts)
  entrar: (email: string, senha: string) =>
    request<RespostaLogin>("/auth/entrar", { method: "POST", body: { email, senha } satisfies PedidoLogin }),
  eu: (token: string) => request<{ nome: string; email: string }>("/auth/eu", { token }),

  // Turmas do professor (cada um vê só as próprias).
  turmas: (token?: string | null) => request<TurmaResumo[]>("/turmas", { token, professor: true }),
  anos: (token?: string | null) => request<AnoDisponivel[]>("/anos", { token, professor: true }),
  criarTurma: (pedido: PedidoNovaTurma) =>
    request<TurmaResumo>("/turmas", { method: "POST", body: pedido, professor: true }),
  adicionarAluno: (turmaId: string, nome: string) =>
    request<AlunoCadastro>(`/turmas/${turmaId}/alunos`, { method: "POST", body: { nome }, professor: true }),

  // Painel do professor. No servidor recebe o token; no navegador passa pela ponte.
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

  // Resposta gerada no backend (LLM sobre os dados da turma). Sem backend, o mock devolve exemplos.
  chatTurma: (turmaId: string, pergunta: string, historico: MensagemChat[] = []) =>
    request<MensagemChat>(`/turmas/${encodeURIComponent(turmaId)}/chat`, {
      method: "POST",
      body: { pergunta, historico } satisfies PedidoChatTurma,
      professor: true,
    }),
  // Gera um exercício de reforço para a habilidade (via LLM no backend, com fallback no banco).
  gerarExercicio: (habilidadeId: string, nivel: Nivel = "facil") =>
    request<Exercicio>("/exercicios/gerar", {
      method: "POST",
      body: { habilidadeId, nivel } satisfies PedidoExercicio,
      professor: true,
    }),

  // STT: envia um áudio curto (multipart) e recebe o texto transcrito (Whisper na Groq).
  // Não usa request() porque o corpo é FormData — o navegador define o Content-Type.
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

  // Aluno (sem conta: entra pelo código da turma e confirma quem é com o PIN)
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

  // Responsável: progresso só do filho dono da credencial (chamado no servidor, com o
  // `acesso` guardado em cookie httpOnly — o navegador nunca vê a credencial).
  progressoResponsavel: (acesso: string) =>
    request<ProgressoResponsavel>("/responsavel/progresso", {
      method: "POST",
      body: { acesso } satisfies PedidoProgresso,
    }),
};
