import type { Metadata } from "next";
import { LinkVoltar } from "@/components/voltar";
import { ChatTurma } from "@/components/painel/chat-turma";
import { api } from "@/lib/api";
import { getProfessor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversa da turma" };

export default async function ConversaPage() {
  const usuario = await getProfessor();
  const { turma } = await api.turmaConfig(usuario.token);

  return (
    <div className="mx-auto max-w-3xl">
      <LinkVoltar href="/painel">Alunos</LinkVoltar>
      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">Conversa da turma</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          Pergunte sobre o padrão geral da turma e peça sugestões de atividade. Revise as respostas antes de levar
          para a sala.
        </p>
      </header>
      <div className="mt-6">
        <ChatTurma turma={turma} token={usuario.token} />
      </div>
    </div>
  );
}
