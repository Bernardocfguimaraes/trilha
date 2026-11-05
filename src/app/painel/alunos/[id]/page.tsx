import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkVoltar } from "@/components/voltar";
import { ProgressoAluno } from "@/components/progresso/progresso-aluno";
import { api, ApiError } from "@/lib/api";
import { dataLonga } from "@/lib/formato";
import { getProfessor } from "@/lib/auth";

async function carregar(id: string) {
  const usuario = await getProfessor();
  try {
    return await Promise.all([api.aluno(id, usuario.token), api.historico(id, usuario.token)]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export const metadata: Metadata = { title: "Aluno" };

export default async function AlunoPage({ params }: PageProps<"/painel/alunos/[id]">) {
  const { id } = await params;
  const [aluno, historico] = await carregar(id);

  return (
    <div className="mx-auto max-w-5xl">
      <LinkVoltar href="/painel">Alunos</LinkVoltar>

      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">{aluno.nome}</h1>
        <p className="mt-1 text-pedra">
          {aluno.turma}.{" "}
          {aluno.ultimaAtividade
            ? `Última atividade em ${dataLonga(aluno.ultimaAtividade)}.`
            : "Ainda não fez nenhuma atividade."}
        </p>
      </header>

      <ProgressoAluno aluno={aluno} historico={historico} comExercicio />
    </div>
  );
}
