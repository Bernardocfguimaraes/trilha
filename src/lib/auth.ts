// Login do professor. O backend confere e-mail + senha e devolve um token assinado; o
// token fica num cookie httpOnly (o JavaScript da página não o lê) e só o servidor do Next
// o envia ao backend. Chamadas do navegador passam por /api/professor/*, que anexa o token.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { api } from "./api";

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
