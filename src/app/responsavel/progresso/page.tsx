import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LogOut } from "lucide-react";
import { ProgressoAluno } from "@/components/progresso/progresso-aluno";
import { api, ApiError } from "@/lib/api";
import { dataLonga } from "@/lib/formato";
import { COOKIE_RESPONSAVEL } from "@/lib/responsavel";
import type { ProgressoResponsavel } from "@/lib/types";

export const metadata: Metadata = { title: "Progresso" };

// Só leitura: o backend devolve apenas o aluno dono da credencial do PIN. Aqui não há
// geração de exercício, lista da turma, configuração nem PINs.
export default async function ProgressoResponsavelPage() {
  await connection();
  const acesso = (await cookies()).get(COOKIE_RESPONSAVEL)?.value;
  if (!acesso) redirect("/responsavel");

  let dados: ProgressoResponsavel;
  try {
    dados = await api.progressoResponsavel(acesso);
  } catch (e) {
    // Credencial que não vale mais: PIN trocado pelo professor ou backend reiniciado.
    if (e instanceof ApiError && e.status === 401) redirect("/responsavel?erro=expirou");
    throw e;
  }
  const { aluno, historico } = dados;

  return (
    <main className="mx-auto mt-6 w-full max-w-5xl pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header>
          <p className="text-sm font-semibold text-pedra">{aluno.turma}</p>
          <h1 className="mt-1 text-3xl font-bold text-grafite">{aluno.nome}</h1>
          <p className="mt-1 text-pedra">
            {aluno.ultimaAtividade
              ? `Última atividade em ${dataLonga(aluno.ultimaAtividade)}.`
              : "Ainda não fez nenhuma atividade."}
          </p>
        </header>
        <form action="/responsavel/sair" method="post">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold text-pedra outline-none hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogOut className="size-4" aria-hidden />
            Sair
          </button>
        </form>
      </div>

      <ProgressoAluno aluno={aluno} historico={historico} />
    </main>
  );
}
