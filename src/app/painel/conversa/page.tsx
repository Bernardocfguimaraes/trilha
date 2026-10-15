import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatTurma } from "@/components/painel/chat-turma";
import { api } from "@/lib/api";
import { getUsuario } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conversa da turma" };

export default async function ConversaPage() {
  const usuario = await getUsuario();
  if (usuario?.papel !== "professor") redirect("/painel");
  const { turma } = await api.turmaConfig(usuario.token);

  return (
    <div className="mx-auto max-w-3xl">
      <header>
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
