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
  PedidoPin,
  PedidoSessao,
  PedidoTurmaConfig,
  ResultadoPin,
  ResultadoResposta,
  ResultadoSessao,
  Sessao,
  TurmaConfig,
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
  token?: string | null;
}

async function request<T>(path: string, { method = "GET", body, token }: Opcoes = {}): Promise<T> {
  // Sem NEXT_PUBLIC_API_URL, usamos respostas de exemplo para desenvolver a interface.
  // No servidor o mock roda direto; no navegador ele passa por /api/mock, para que
  // painel e aluno enxerguem o mesmo estado (config salva, sessões, PINs).
  if (!API_URL && typeof window === "undefined") {
    const { mockRequest } = await import("./mock");
    return mockRequest<T>(path, method, body);
  }

  const res = await fetch(`${API_URL ?? "/api/mock"}${path}`, {
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
  // Painel (responsável/professor)
  alunos: (token?: string | null) => request<AlunoResumo[]>("/alunos", { token }),
  aluno: (id: string, token?: string | null) =>
    request<AlunoDetalhe>(`/alunos/${id}`, { token }),
  historico: (id: string, token?: string | null) =>
    request<HistoricoHabilidade[]>(`/alunos/${id}/historico`, { token }),
  turmaConfig: (token?: string | null) => request<TurmaConfig>("/turma/configuracao", { token }),
  salvarTurmaConfig: (habilidadesAtivas: string[], token?: string | null, disciplinasAtivas?: string[]) =>
    request<TurmaConfig>("/turma/configuracao", {
      method: "PUT",
      body: { habilidadesAtivas, disciplinasAtivas } satisfies PedidoTurmaConfig,
      token,
    }),

  // Resposta gerada no backend (LLM sobre os dados da turma). Sem backend, o mock devolve exemplos.
  chatTurma: (turmaId: string, pergunta: string, historico: MensagemChat[] = [], token?: string | null) =>
    request<MensagemChat>(`/turmas/${encodeURIComponent(turmaId)}/chat`, {
      method: "POST",
      body: { pergunta, historico } satisfies PedidoChatTurma,
      token,
    }),
  // Gera um exercício de reforço para a habilidade (via LLM no backend, com fallback no banco).
  gerarExercicio: (habilidadeId: string, nivel: Nivel = "facil", token?: string | null) =>
    request<Exercicio>("/exercicios/gerar", {
      method: "POST",
      body: { habilidadeId, nivel } satisfies PedidoExercicio,
      token,
    }),
  alunosTurma: (token?: string | null) => request<AlunoCadastro[]>("/turma/alunos", { token }),
  regenerarPin: (alunoId: string, token?: string | null) =>
    request<AlunoCadastro>(`/turma/alunos/${alunoId}/pin`, { method: "POST", token }),

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
};
