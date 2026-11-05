import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EntradaResponsavel } from "@/components/responsavel/entrada-responsavel";
import { api, ApiError } from "@/lib/api";
import type { TurmaPublica } from "@/lib/types";

export const metadata: Metadata = { title: "Acompanhar meu filho" };

export default async function TurmaResponsavelPage({ params }: PageProps<"/responsavel/[codigo]">) {
  const { codigo } = await params;
  await connection();
  let turma: TurmaPublica;
  try {
    turma = await api.turmaPublica(decodeURIComponent(codigo));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) redirect("/responsavel?erro=codigo");
    throw e;
  }
  return <EntradaResponsavel turma={turma} />;
}
