import { StatusSelo } from "@/components/marca";
import { ExercicioReforco } from "@/components/painel/exercicio-reforco";
import { GraficoEvolucao } from "@/components/painel/grafico-evolucao";
import { dataCurta, dataLonga } from "@/lib/formato";
import type { AlunoDetalhe, HistoricoHabilidade, Status } from "@/lib/types";

const ORDEM: Record<Status, number> = { alerta: 0, atencao: 1, ok: 2 };

/**
 * Progresso de um aluno: caminho BNCC, recomendações e evolução por habilidade.
 * Usado no painel do professor e na tela do responsável. `comExercicio` liga o botão de
 * gerar exercício de reforço (só o professor tem).
 */
export function ProgressoAluno({
  aluno,
  historico,
  comExercicio = false,
}: {
  aluno: AlunoDetalhe;
  historico: HistoricoHabilidade[];
  comExercicio?: boolean;
}) {
  const recomendacoes = [...aluno.recomendacoes].sort((a, b) => ORDEM[a.status] - ORDEM[b.status]);
  const statusPor = new Map(aluno.habilidades.map((h) => [h.habilidadeId, h.status]));
  const graficos = [...historico].sort(
    (a, b) => ORDEM[statusPor.get(a.habilidadeId) ?? "ok"] - ORDEM[statusPor.get(b.habilidadeId) ?? "ok"],
  );
  // Cada habilidade acumula pontos só nos dias em que foi trabalhada: a tabela usa a união das datas.
  const datas = [...new Set(graficos.flatMap((h) => h.pontos.map((p) => p.data)))].sort();

  return (
    <>
    {aluno.caminhos.length > 0 && (
      <section className="mt-10" aria-labelledby="caminho">
        <h2 id="caminho" className="text-xl font-bold text-grafite">
          Caminho BNCC
        </h2>
        <p className="mt-1 max-w-prose text-pedra">
          Uma habilidade conta como concluída quando o desempenho fica bom em pelo menos três dias de atividade.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {aluno.caminhos.map((c) => (
            <article key={c.disciplinaId} className="rounded-lg border bg-superficie p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold text-grafite">
                  {c.disciplina} · {c.ano}º ano
                </h3>
                <span className="text-sm text-pedra tabular-nums">
                  {c.concluidas} de {c.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`Habilidades concluídas em ${c.disciplina}`}
                aria-valuemin={0}
                aria-valuemax={c.total}
                aria-valuenow={c.concluidas}
                className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"
              >
                <div className="h-full animate-cresce rounded-full bg-mata" style={{ width: `${(100 * c.concluidas) / Math.max(c.total, 1)}%` }} />
              </div>
              {c.atual ? (
                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-pedra">Agora</dt>
                    <dd className="font-semibold text-grafite">
                      {c.atual.codigoBncc && <span className="mr-1.5 font-mono text-xs font-normal text-pedra">{c.atual.codigoBncc}</span>}
                      {c.atual.nome}
                    </dd>
                  </div>
                  {c.proximas.length > 0 && (
                    <div>
                      <dt className="text-pedra">Em seguida</dt>
                      <dd className="text-grafite">{c.proximas.map((p) => p.nome).join(" · ")}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="mt-4 text-sm font-semibold text-mata">Caminho concluído.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    )}

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
                "rounded-lg border bg-superficie p-5 border-l-4 " +
                (r.status === "alerta" ? "border-l-alerta" : r.status === "atencao" ? "border-l-atencao" : "border-l-mata")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-grafite">{r.habilidade}</h3>
                <StatusSelo status={r.status} />
              </div>
              <p className="mt-3 max-w-prose text-[1.0625rem] leading-relaxed text-grafite">{r.texto}</p>
              <p className="mt-3 text-sm text-pedra">Gerada em {dataLonga(r.geradaEm)}</p>
              {comExercicio && <ExercicioReforco habilidadeId={r.habilidadeId} status={r.status} />}
            </article>
          ))}
        </div>
      )}
    </section>

    <section className="mt-12" aria-labelledby="evolucao">
      <h2 id="evolucao" className="text-xl font-bold text-grafite">
        Evolução por habilidade
      </h2>
      <p className="mt-1 max-w-prose text-pedra">
        Desempenho em cada dia de atividade, de 0 a 100. Cada sessão nova se soma ao histórico
        {datas.length > 0 && ` (${datas.length} ${datas.length === 1 ? "dia registrado" : "dias registrados"})`}.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {graficos.map((h) => (
          <figure key={h.habilidadeId} className="rounded-lg border bg-superficie p-4">
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

      <details className="mt-4 rounded-lg border bg-superficie">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-grafite">Ver dados em tabela</summary>
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-pedra">
                <th className="px-4 py-2 font-semibold">Habilidade</th>
                {datas.map((data) => (
                  <th key={data} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                    {dataCurta(data)}
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
                  {datas.map((data) => (
                    <td key={data} className="px-3 py-2 text-right tabular-nums">
                      {h.pontos.find((p) => p.data === data)?.desempenho ?? <span className="text-pedra">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
    </>
  );
}
