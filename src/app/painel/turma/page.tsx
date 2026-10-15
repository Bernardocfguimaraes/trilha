import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CodigoTurma, FormTurma } from "@/components/painel/form-turma";
import { PinsAlunos } from "@/components/painel/pins-alunos";
import { api } from "@/lib/api";
import { getUsuario } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Turma" };

export default async function TurmaPage() {
  const usuario = await getUsuario();
  if (usuario?.papel !== "professor") redirect("/painel");
  const [config, alunos] = await Promise.all([api.turmaConfig(usuario.token), api.alunosTurma(usuario.token)]);

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-3xl font-bold text-grafite">{config.turma.nome}</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          Escolha as habilidades trabalhadas no {config.ciclo}. As atividades dos alunos e o diagnóstico passam a
          considerar só as habilidades ativas.
        </p>
      </header>
      <div className="mt-8">
        <CodigoTurma codigo={config.turma.codigo} />
      </div>
      <div className="mt-8">
        <PinsAlunos alunos={alunos} token={usuario.token} />
      </div>
      <div className="mt-8">
        <FormTurma config={config} token={usuario.token} />
      </div>
    </div>
  );
}
