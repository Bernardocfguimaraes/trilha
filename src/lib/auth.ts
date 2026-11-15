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

export const professorAtual = cache(async (): Promise<Professor | null> => {
  await connection();
  const token = (await cookies()).get(COOKIE_PROFESSOR)?.value;
  if (!token) return null;
  try {
    const eu = await api.eu(token);
    return { ...eu, token };
  } catch {
    return null;
  }
});

export async function getProfessor(): Promise<Professor> {
  const professor = await professorAtual();
  if (!professor) redirect("/entrar?expirou=1");
  return professor;
}

export const COOKIE_TURMA = "trilha_turma";

export interface Contexto {
  professor: Professor;
  turmas: TurmaResumo[];
  turma: TurmaResumo;
}

export const turmasDoProfessor = cache(async (): Promise<{ professor: Professor; turmas: TurmaResumo[] }> => {
  const professor = await getProfessor();
  return { professor, turmas: await api.turmas(professor.token) };
});

export async function getTurmaAtual(): Promise<Contexto> {
  const { professor, turmas } = await turmasDoProfessor();
  if (turmas.length === 0) redirect("/painel/turmas/nova");
  const escolhida = (await cookies()).get(COOKIE_TURMA)?.value;
  const turma = turmas.find((t) => t.id === escolhida) ?? turmas[0];
  return { professor, turmas, turma };
}
