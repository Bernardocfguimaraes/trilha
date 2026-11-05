// Login do professor. O backend confere e-mail + senha e devolve um token assinado; o
// token fica num cookie httpOnly (o JavaScript da página não o lê) e só o servidor do Next
// o envia ao backend. Chamadas do navegador passam por /api/professor/*, que anexa o token.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { api } from "./api";
import type { TurmaResumo } from "./types";

export const COOKIE_PROFESSOR = "trilha_sessao";

export function opcoesCookie(https: boolean, maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: https, path: "/", maxAge };
}

export interface Professor {
  nome: string;
  email: string;
  token: string;
}

/** Professor logado nesta requisição, conferido no backend (uma vez por requisição). */
export const professorAtual = cache(async (): Promise<Professor | null> => {
  await connection(); // depende da requisição: nunca entra na pré-renderização
  const token = (await cookies()).get(COOKIE_PROFESSOR)?.value;
  if (!token) return null;
  try {
    const eu = await api.eu(token);
    return { ...eu, token };
  } catch {
    return null; // token vencido, adulterado ou de um segredo antigo
  }
});

/** Páginas do painel: sem login válido, vai para /entrar. */
export async function getProfessor(): Promise<Professor> {
  const professor = await professorAtual();
  if (!professor) redirect("/entrar?expirou=1");
  return professor;
}

// --- Turma atual -----------------------------------------------------------------
// O professor pode ter várias turmas; a que ele está vendo fica num cookie. Sem nenhuma
// turma, o painel leva para a página de criar a primeira.

export const COOKIE_TURMA = "trilha_turma";

export interface Contexto {
  professor: Professor;
  turmas: TurmaResumo[];
  turma: TurmaResumo;
}

/** Turmas do professor logado (uma busca por requisição). */
export const turmasDoProfessor = cache(async (): Promise<{ professor: Professor; turmas: TurmaResumo[] }> => {
  const professor = await getProfessor();
  return { professor, turmas: await api.turmas(professor.token) };
});

/** Professor + turma que ele está vendo. Sem turmas, redireciona para criar a primeira. */
export async function getTurmaAtual(): Promise<Contexto> {
  const { professor, turmas } = await turmasDoProfessor();
  if (turmas.length === 0) redirect("/painel/turmas/nova");
  const escolhida = (await cookies()).get(COOKIE_TURMA)?.value;
  const turma = turmas.find((t) => t.id === escolhida) ?? turmas[0];
  return { professor, turmas, turma };
}
