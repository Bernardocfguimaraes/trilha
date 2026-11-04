import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Previa } from "./previa";

export const metadata: Metadata = { title: "Prévia das questões" };

// Só em desenvolvimento: mostra os tipos de questão interativa com perguntas reais do
// banco, sem precisar de turma, PIN nem sorteio da sessão. Não existe no build de produção.
export default function PreviaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Previa />;
}
