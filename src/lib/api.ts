import type {
  AlunoDetalhe,
  AlunoResumo,
  HistoricoHabilidade,
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
  salvarTurmaConfig: (habilidadesAtivas: string[], token?: string | null) =>
    request<TurmaConfig>("/turma/configuracao", {
      method: "PUT",
      body: { habilidadesAtivas },
      token,
    }),

  // Aluno (sem conta: entra pelo código da turma)
  turmaPublica: (codigo: string) =>
    request<TurmaPublica>(`/turmas/${encodeURIComponent(codigo)}`),
  iniciarSessao: (codigo: string, alunoId: string) =>
    request<Sessao>("/sessoes", { method: "POST", body: { codigo, alunoId } }),
  responder: (sessaoId: string, perguntaId: string, opcaoId: string) =>
    request<ResultadoResposta>(`/sessoes/${sessaoId}/respostas`, {
      method: "POST",
      body: { perguntaId, opcaoId },
    }),
  concluirSessao: (sessaoId: string) =>
    request<ResultadoSessao>(`/sessoes/${sessaoId}/concluir`, { method: "POST" }),
};
