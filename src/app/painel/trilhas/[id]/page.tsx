import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkVoltar } from "@/components/voltar";
import { EditorTrilha } from "@/components/painel/trilhas/editor-trilha";
import { api, ApiError } from "@/lib/api";
import { getTurmaAtual } from "@/lib/auth";

export const metadata: Metadata = { title: "Trilha da semana" };

async function carregar(id: string, token: string, turmaId: string) {
  try {
    return await Promise.all([api.trilha(id, token), api.conteudos(turmaId, token)]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export default async function TrilhaPage({ params }: PageProps<"/painel/trilhas/[id]">) {
  const { id } = await params;
  const { professor, turma } = await getTurmaAtual();
  const [trilha, conteudos] = await carregar(id, professor.token, turma.id);

  return (
    <div className="mx-auto max-w-5xl">
      <LinkVoltar href="/painel/trilhas">Trilhas da semana</LinkVoltar>
      <header className="mt-4">
        <p className="text-sm font-semibold text-pedra">{trilha.disciplina}</p>
        <h1 className="text-3xl font-bold text-grafite">{trilha.titulo}</h1>
      </header>
      <div className="mt-8">
        <EditorTrilha key={trilha.id} turmaId={turma.id} conteudos={conteudos} inicial={trilha} />
      </div>
    </div>
  );
}
