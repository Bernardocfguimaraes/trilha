import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatusSelo } from "@/components/marca";
import { GraficoEvolucao } from "@/components/painel/grafico-evolucao";
import { api, ApiError } from "@/lib/api";
import { dataCurta, dataLonga } from "@/lib/formato";
import { getUsuario } from "@/lib/supabase/server";
import type { Status } from "@/lib/types";

const ORDEM: Record<Status, number> = { alerta: 0, atencao: 1, ok: 2 };

async function carregar(id: string) {
  const usuario = await getUsuario();
  try {
    return await Promise.all([api.aluno(id, usuario?.token), api.historico(id, usuario?.token)]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export const metadata: Metadata = { title: "Aluno" };

export default async function AlunoPage({ params }: PageProps<"/painel/alunos/[id]">) {
  const { id } = await params;
  const [aluno, historico] = await carregar(id);
  const recomendacoes = [...aluno.recomendacoes].sort((a, b) => ORDEM[a.status] - ORDEM[b.status]);
  const statusPor = new Map(aluno.habilidades.map((h) => [h.habilidadeId, h.status]));
  const graficos = [...historico].sort(
    (a, b) => ORDEM[statusPor.get(a.habilidadeId) ?? "ok"] - ORDEM[statusPor.get(b.habilidadeId) ?? "ok"],
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/painel"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-pedra outline-none hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" />
        Alunos
      </Link>

      <header className="mt-4">
        <h1 className="text-3xl font-bold text-grafite">{aluno.nome}</h1>
        <p className="mt-1 text-pedra">
          {aluno.turma}.{" "}
          {aluno.ultimaAtividade
            ? `Última atividade em ${dataLonga(aluno.ultimaAtividade)}.`
            : "Ainda não fez nenhuma atividade."}
        </p>
      </header>

      <section className="mt-10" aria-labelledby="recomendacoes">
        <h2 id="recomendacoes" className="text-xl font-bold text-grafite">
          Recomendações
        </h2>
        {recomendacoes.length === 0 ? (
          <p className="mt-3 max-w-prose text-pedra">
            Nenhuma habilidade pede atenção agora. As recomendações aparecem aqui quando o desempenho em alguma
            habilidade cair.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {recomendacoes.map((r) => (
              <article
                key={r.habilidadeId}
                className={
                  "rounded-lg border bg-white p-5 border-l-4 " +
                  (r.status === "alerta" ? "border-l-alerta" : r.status === "atencao" ? "border-l-atencao" : "border-l-mata")
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-grafite">{r.habilidade}</h3>
                  <StatusSelo status={r.status} />
                </div>
                <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-grafite">{r.texto}</p>
                <p className="mt-3 text-sm text-pedra">Gerada em {dataLonga(r.geradaEm)}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="evolucao">
        <h2 id="evolucao" className="text-xl font-bold text-grafite">
          Evolução por habilidade
        </h2>
        <p className="mt-1 max-w-prose text-pedra">Desempenho semanal nas atividades, de 0 a 100.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {graficos.map((h) => (
            <figure key={h.habilidadeId} className="rounded-lg border bg-white p-4">
              <figcaption className="mb-3 flex items-start justify-between gap-2">
                <span>
                  <span className="block font-semibold text-grafite">{h.nome}</span>
                  <span className="text-sm text-pedra">{h.disciplina}</span>
                </span>
                {statusPor.get(h.habilidadeId) && <StatusSelo status={statusPor.get(h.habilidadeId)!} className="text-xs" />}
              </figcaption>
              <GraficoEvolucao historico={h} />
            </figure>
          ))}
        </div>

        <details className="mt-4 rounded-lg border bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-grafite">Ver dados em tabela</summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-pedra">
                  <th className="px-4 py-2 font-semibold">Habilidade</th>
                  {graficos[0]?.pontos.map((p) => (
                    <th key={p.data} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      {dataCurta(p.data)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {graficos.map((h) => (
                  <tr key={h.habilidadeId} className="border-b last:border-b-0">
                    <th scope="row" className="px-4 py-2 text-left font-semibold whitespace-nowrap text-grafite">
                      {h.nome}
                    </th>
                    {h.pontos.map((p) => (
                      <td key={p.data} className="px-3 py-2 text-right tabular-nums">
                        {p.desempenho}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
