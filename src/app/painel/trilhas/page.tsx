import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus, Route, Users } from "lucide-react";
import { LinkVoltar } from "@/components/voltar";
import { IconeDisciplina } from "@/components/aluno/disciplinas";
import { SemServidor } from "@/components/painel/trilhas/sem-servidor";
import { api } from "@/lib/api";
import { getTurmaAtual } from "@/lib/auth";
import { dataLonga } from "@/lib/formato";
import type { SituacaoTrilha, TrilhaResumo } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Trilhas da semana" };

const GRUPOS: { situacao: SituacaoTrilha; titulo: string; vazio: string }[] = [
  { situacao: "lancada", titulo: "Disponíveis para os alunos", vazio: "Nenhuma trilha lançada agora." },
  { situacao: "rascunho", titulo: "Rascunhos", vazio: "" },
  { situacao: "encerrada", titulo: "Encerradas", vazio: "" },
];

export default async function TrilhasPage() {
  const { professor, turma } = await getTurmaAtual();
  const semServidor = !process.env.NEXT_PUBLIC_API_URL;
  const trilhas = semServidor ? [] : await api.trilhas(turma.id, professor.token);

  return (
    <div className="mx-auto max-w-5xl">
      <LinkVoltar href="/painel">Alunos</LinkVoltar>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-grafite">Trilhas da semana</h1>
          <p className="mt-2 max-w-prose text-lg text-pedra">
            Monte as perguntas do que você está trabalhando em sala e lance para o {turma.nome}. Os alunos respondem exatamente essas
            perguntas, cada um numa ordem diferente.
          </p>
        </div>
        {!semServidor && (
          <Link
            href="/painel/trilhas/nova"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground outline-none hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden />
            Montar trilha da semana
          </Link>
        )}
      </header>

      {semServidor ? (
        <SemServidor />
      ) : trilhas.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-superficie p-8 text-center">
          <Route className="mx-auto size-9 text-mata" aria-hidden />
          <p className="mt-3 text-lg font-semibold text-grafite">Nenhuma trilha ainda</p>
          <p className="mx-auto mt-1 max-w-md text-pedra">
            Conte para a IA o que você trabalhou na aula, revise as perguntas que ela sugerir, acrescente as suas e lance para a turma.
          </p>
        </div>
      ) : (
        GRUPOS.map((g) => {
          const lista = trilhas.filter((t) => t.situacao === g.situacao);
          if (!lista.length && !g.vazio) return null;
          return (
            <section key={g.situacao} className="mt-8" aria-labelledby={`grupo-${g.situacao}`}>
              <h2 id={`grupo-${g.situacao}`} className="text-lg font-bold text-grafite">
                {g.titulo}
              </h2>
              {lista.length === 0 ? (
                <p className="mt-2 text-pedra">{g.vazio}</p>
              ) : (
                <ul className="mt-3 grid gap-4 md:grid-cols-2">
                  {lista.map((t) => (
                    <li key={t.id}>
                      <CartaoTrilha trilha={t} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function CartaoTrilha({ trilha }: { trilha: TrilhaResumo }) {
  const percentual = trilha.alunos ? Math.round((trilha.feitos / trilha.alunos) * 100) : 0;
  return (
    <Link
      href={`/painel/trilhas/${trilha.id}`}
      className={cn(
        "block rounded-lg border bg-superficie p-5 outline-none transition-colors hover:border-mata/50 focus-visible:ring-3 focus-visible:ring-ring/50",
        trilha.situacao === "encerrada" && "opacity-80",
      )}
    >
      <div className="flex items-start gap-3">
        <IconeDisciplina id={trilha.disciplinaId} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-pedra">{trilha.disciplina}</p>
          <p className="truncate text-lg font-bold text-grafite">{trilha.titulo}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-pedra">Perguntas</dt>
          <dd className="font-semibold text-grafite">{trilha.totalPerguntas || "Sorteadas do banco"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-pedra">
            <CalendarDays className="size-3.5" aria-hidden />
            {trilha.situacao === "encerrada" ? "Terminou" : "Até"}
          </dt>
          <dd className="font-semibold text-grafite">{dataLonga(trilha.fim)}</dd>
        </div>
      </dl>
      {trilha.situacao !== "rascunho" && (
        <div className="mt-4">
          <p className="flex items-center gap-1 text-sm text-pedra">
            <Users className="size-3.5" aria-hidden />
            {trilha.feitos} de {trilha.alunos} alunos fizeram
          </p>
          <div className="mt-1.5 h-2 rounded-full bg-secondary" aria-hidden>
            <div className="h-2 rounded-full bg-mata" style={{ width: `${percentual}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}
