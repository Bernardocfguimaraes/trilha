import type { Metadata } from "next";
import { LinkVoltar } from "@/components/voltar";
import { FormNovaTurma } from "@/components/painel/form-nova-turma";
import { api } from "@/lib/api";
import { turmasDoProfessor } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova turma" };

// Página própria para criar turma. No primeiro acesso (professor sem turmas) é para cá que
// o painel leva, com boas-vindas; depois, fica no "Nova turma" da barra lateral.
export default async function NovaTurmaPage() {
  const { professor, turmas } = await turmasDoProfessor();
  const anos = await api.anos(professor.token);
  const primeira = turmas.length === 0;
  const primeiroNome = professor.nome.replace(/^(Profa?\.|Professora?)\s+/i, "").split(" ")[0];

  return (
    <div className="mx-auto max-w-2xl">
      {!primeira && <LinkVoltar href="/painel">Alunos</LinkVoltar>}
      <header className={primeira ? "" : "mt-4"}>
        <h1 className="text-3xl font-bold text-grafite">
          {primeira ? `Boas-vindas, ${primeiroNome}! Vamos criar sua primeira turma` : "Nova turma"}
        </h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          {primeira
            ? "Escolha o ano e cadastre os alunos. A turma ganha um código para as crianças entrarem, e cada uma recebe um PIN. Depois você pode criar outras turmas pela barra lateral."
            : "A turma ganha um código para as crianças entrarem, e cada aluno recebe um PIN de 4 números."}
        </p>
      </header>
      <FormNovaTurma anos={anos} />
    </div>
  );
}
