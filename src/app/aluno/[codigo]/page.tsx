import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Jornada } from "@/components/aluno/jornada";
import { api, ApiError } from "@/lib/api";
import type { TurmaPublica } from "@/lib/types";

export const metadata: Metadata = { title: "Trilha de hoje" };

export default async function TurmaAlunoPage({ params }: PageProps<"/aluno/[codigo]">) {
  const { codigo } = await params;
  await connection(); // dados da turma sempre frescos, buscados na hora
  let turma: TurmaPublica;
  try {
    turma = await api.turmaPublica(decodeURIComponent(codigo));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) redirect("/aluno?erro=codigo");
    throw e;
  }
  return <Jornada turma={turma} />;
}
