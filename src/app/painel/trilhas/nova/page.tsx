import type { Metadata } from "next";
import { LinkVoltar } from "@/components/voltar";
import { EditorTrilha } from "@/components/painel/trilhas/editor-trilha";
import { SemServidor } from "@/components/painel/trilhas/sem-servidor";
import { api } from "@/lib/api";
import { getTurmaAtual } from "@/lib/auth";

export const metadata: Metadata = { title: "Montar trilha da semana" };

export default async function NovaTrilhaPage() {
  const { professor, turma } = await getTurmaAtual();
  const semServidor = !process.env.NEXT_PUBLIC_API_URL;
  const conteudos = semServidor ? null : await api.conteudos(turma.id, professor.token);

  return (
    <div className="mx-auto max-w-5xl">
      <LinkVoltar href="/painel/trilhas">Trilhas da semana</LinkVoltar>
      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">Montar trilha da semana</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">Escolha o conteúdo que está em sala, junte as perguntas e lance para o {turma.nome}.</p>
      </header>
      <div className="mt-8">{conteudos ? <EditorTrilha turmaId={turma.id} conteudos={conteudos} inicial={null} /> : <SemServidor />}</div>
    </div>
  );
}
