import type { Metadata } from "next";
import Link from "next/link";
import { LinkVoltar } from "@/components/voltar";
import { api } from "@/lib/api";
import { getTurmaAtual } from "@/lib/auth";
import type { GrupoReforco } from "@/lib/types";

export const metadata: Metadata = { title: "Grupos de reforço" };

function leituraSilhueta(s: number) {
  if (s >= 0.5) return "grupos bem separados";
  if (s >= 0.25) return "grupos com separação moderada";
  return "perfis próximos: use os grupos como ponto de partida, não como regra";
}

export default async function GruposPage() {
  const { professor, turma } = await getTurmaAtual();
  const dados = await api.gruposTurma(turma.id, professor.token);

  return (
    <div className="mx-auto max-w-5xl">
      <LinkVoltar href="/painel">Alunos</LinkVoltar>
      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">Grupos de reforço</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          Alunos do {turma.nome} com dificuldades parecidas, agrupados automaticamente. Ajuda a montar mesas de reforço sem
          precisar cruzar a planilha inteira.
        </p>
      </header>

      {dados.grupos.length === 0 ? (
        <p className="mt-8 rounded-lg border bg-superficie p-6 text-grafite">{dados.observacao}</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {dados.grupos.map((g) => (
            <li key={g.nome}>
              <CartaoGrupo grupo={g} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-12 rounded-lg border bg-superficie p-6" aria-labelledby="como">
        <h2 id="como" className="text-xl font-bold text-grafite">
          Como os grupos são formados
        </h2>
        <ul className="mt-3 max-w-prose space-y-2 text-pedra">
          <li>
            Cada aluno vira um perfil: a média recente (últimos 3 dias) em cada habilidade que a turma já praticou. Onde o aluno
            ainda não praticou, entra a média da turma, para não puxá-lo para nenhum grupo.
          </li>
          <li>
            O algoritmo <strong className="font-semibold text-grafite">k-means</strong> (aprendizado não supervisionado) junta os
            perfis mais parecidos. Testamos de 2 a 4 grupos e ficamos com o número de maior coeficiente de silhueta, que mede o
            quanto cada aluno está mais perto do próprio grupo do que do vizinho.
          </li>
          <li>O foco de cada grupo são as habilidades em que ele fica bem abaixo da média da turma.</li>
        </ul>
        {dados.silhueta !== null && (
          <p className="mt-4 text-sm text-pedra">
            Nesta turma: {dados.alunosConsiderados} alunos com atividades, {dados.k} grupos, silhueta{" "}
            {dados.silhueta.toFixed(2).replace(".", ",")} ({leituraSilhueta(dados.silhueta)}).
          </p>
        )}
      </section>
    </div>
  );
}

function CartaoGrupo({ grupo }: { grupo: GrupoReforco }) {
  return (
    <article className="flex h-full flex-col rounded-xl border bg-superficie p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-grafite">{grupo.nome}</h2>
        <span className="text-sm text-pedra">
          {grupo.alunos.length} {grupo.alunos.length === 1 ? "aluno" : "alunos"}
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Alunos do grupo">
        {grupo.alunos.map((a) => (
          <li key={a.id}>
            <Link
              href={`/painel/alunos/${a.id}`}
              className="inline-block rounded-md bg-secondary px-2 py-1 text-sm font-medium text-grafite outline-none hover:bg-mata-clara focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {a.nome}
            </Link>
          </li>
        ))}
      </ul>

      {grupo.foco.length === 0 ? (
        <p className="mt-4 border-t pt-3 text-sm text-pedra">
          Sem foco de reforço: o grupo acompanha a turma ou está acima dela. Bom momento para propor desafios.
        </p>
      ) : (
        <div className="mt-4 border-t pt-3">
          <p className="text-sm font-semibold text-grafite">Foco do reforço</p>
          <ul className="mt-2 space-y-3">
            {grupo.foco.map((f) => (
              <li key={f.habilidadeId} title={`${f.nome}: ${f.mediaGrupo} no grupo, ${f.mediaTurma} na turma`}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-grafite">
                    {f.nome} <span className="text-pedra">· {f.disciplina}</span>
                  </span>
                  <span className="shrink-0 text-xs text-pedra tabular-nums">
                    <span className="font-semibold text-grafite">{f.mediaGrupo}</span> grupo · {f.mediaTurma} turma
                  </span>
                </div>
                {/* Halteres: os dois valores na mesma escala de 0 a 100. */}
                <div className="relative mt-1.5 h-3" aria-hidden>
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                  <div
                    className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-mata/40"
                    style={{ left: `${f.mediaGrupo}%`, width: `${Math.max(f.mediaTurma - f.mediaGrupo, 0)}%` }}
                  />
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mata/40 ring-2 ring-superficie"
                    style={{ left: `${f.mediaTurma}%` }}
                  />
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mata ring-2 ring-superficie"
                    style={{ left: `${f.mediaGrupo}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-3 text-xs text-pedra">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-mata" aria-hidden /> média do grupo
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-full bg-mata/40" aria-hidden /> média da turma
            </span>
          </p>
        </div>
      )}
    </article>
  );
}
