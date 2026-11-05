import type { Metadata } from "next";
import { LinkVoltar } from "@/components/voltar";
import { CodigoTurma, FormTurma } from "@/components/painel/form-turma";
import { PinsAlunos } from "@/components/painel/pins-alunos";
import { api } from "@/lib/api";
import { getProfessor } from "@/lib/auth";

export const metadata: Metadata = { title: "Turma" };

export default async function TurmaPage() {
  const usuario = await getProfessor();
  const [config, alunos] = await Promise.all([api.turmaConfig(usuario.token), api.alunosTurma(usuario.token)]);

  return (
    <div className="mx-auto max-w-3xl">
      <LinkVoltar href="/painel">Alunos</LinkVoltar>
      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">{config.turma.nome}</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          Escolha as disciplinas e habilidades trabalhadas no {config.ciclo}. As atividades dos alunos e o
          diagnóstico passam a considerar só o que estiver ativo.
        </p>
      </header>
      <div className="mt-8">
        <CodigoTurma codigo={config.turma.codigo} />
      </div>
      <div className="mt-8">
        <PinsAlunos alunos={alunos} />
      </div>
      <div className="mt-8">
        <FormTurma config={config} />
      </div>
    </div>
  );
}
