import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LinkVoltar } from "@/components/voltar";
import { Marcas, rotuloStatus } from "@/components/marca";
import { BotaoImprimir } from "@/components/painel/botao-imprimir";
import { api, ApiError } from "@/lib/api";
import { getProfessor } from "@/lib/auth";
import { dataLonga } from "@/lib/formato";
import type { HabilidadeStatus, HistoricoHabilidade, Status } from "@/lib/types";

export const metadata: Metadata = { title: "Relatório do aluno" };

async function carregar(id: string) {
  const usuario = await getProfessor();
  try {
    return await Promise.all([api.aluno(id, usuario.token), api.historico(id, usuario.token)]);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

const hoje = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

/** Média dos últimos 3 dias e variação em relação aos 3 primeiros, para leigos. */
function evolucao(h: HistoricoHabilidade | undefined) {
  if (!h || h.pontos.length === 0) return null;
  const v = h.pontos.map((p) => p.desempenho);
  const media = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const recente = media(v.slice(-3));
  const inicio = media(v.slice(0, 3));
  return { recente, variacao: v.length >= 4 ? recente - inicio : null };
}

function frase(status: Status) {
  if (status === "ok") return "Domina bem";
  if (status === "atencao") return "Está aprendendo, precisa praticar";
  return "Precisa de apoio";
}

export default async function RelatorioAlunoPage({ params }: PageProps<"/painel/alunos/[id]/relatorio">) {
  const { id } = await params;
  const [aluno, historico] = await carregar(id);
  const porHab = new Map(historico.map((h) => [h.habilidadeId, h]));
  const praticadas = aluno.habilidades.filter((h) => h.iniciada && porHab.get(h.habilidadeId)?.pontos.length);
  const disciplinas = [...new Set(praticadas.map((h) => h.disciplina))];
  const contagem = (s: Status) => praticadas.filter((h) => h.status === s).length;
  const fortes = praticadas.filter((h) => h.status === "ok" && (evolucao(porHab.get(h.habilidadeId))?.recente ?? 0) >= 80);
  const apoio = praticadas.filter((h) => h.status !== "ok" || h.emRisco);

  return (
    <div className="mx-auto max-w-3xl print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <LinkVoltar href={`/painel/alunos/${aluno.id}`}>{aluno.nome}</LinkVoltar>
        <BotaoImprimir />
      </div>

      <article className="mt-6 rounded-xl border bg-superficie p-6 sm:p-10 print:mt-0 print:rounded-none print:border-0 print:p-0">
        <header className="border-b pb-5">
          <p className="text-sm font-semibold tracking-wide text-pedra uppercase">Relatório de acompanhamento</p>
          <h1 className="mt-1 text-3xl font-bold text-grafite">{aluno.nome}</h1>
          <p className="mt-1 text-pedra">
            {aluno.turma} · emitido em {hoje.format(new Date())}
            {aluno.ultimaAtividade && ` · última atividade em ${dataLonga(aluno.ultimaAtividade)}`}
          </p>
        </header>

        {praticadas.length === 0 ? (
          <p className="mt-6 text-grafite">{aluno.nome.split(" ")[0]} ainda não fez atividades na Trilha.</p>
        ) : (
          <>
            <section className="mt-6" aria-labelledby="resumo">
              <h2 id="resumo" className="text-lg font-bold text-grafite">
                Resumo
              </h2>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                {(["ok", "atencao", "alerta"] as const).map((s) => (
                  <div key={s} className="rounded-lg border p-3 break-inside-avoid">
                    <dt className="flex items-center gap-2 text-sm text-pedra">
                      <Marcas status={s} />
                      {frase(s)}
                    </dt>
                    <dd className="mt-1 text-2xl font-bold text-grafite tabular-nums">
                      {contagem(s)} <span className="text-sm font-normal text-pedra">de {praticadas.length}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {fortes.length > 0 && (
              <section className="mt-6 break-inside-avoid" aria-labelledby="fortes">
                <h2 id="fortes" className="text-lg font-bold text-grafite">
                  Pontos fortes
                </h2>
                <p className="mt-1 text-grafite">{fortes.map((h) => h.nome).join(", ")}.</p>
              </section>
            )}

            {apoio.length > 0 && (
              <section className="mt-6" aria-labelledby="apoio">
                <h2 id="apoio" className="text-lg font-bold text-grafite">
                  Onde vale apoiar em casa
                </h2>
                <ul className="mt-2 space-y-3">
                  {apoio.map((h) => {
                    const rec = aluno.recomendacoes.find(
                      (r) => r.habilidadeId === h.habilidadeId && !r.texto.startsWith("Recomendação em preparação"),
                    );
                    return (
                      <li key={h.habilidadeId} className="break-inside-avoid">
                        <p className="font-semibold text-grafite">
                          {h.nome} <span className="font-normal text-pedra">· {h.disciplina}</span>
                        </p>
                        <p className="text-sm text-pedra">
                          {h.status === "ok"
                            ? "Vai bem hoje, mas o desempenho vem caindo: a previsão indica risco de dificuldade nas próximas semanas."
                            : `${frase(h.status)}.`}
                        </p>
                        {rec && <p className="mt-1 text-sm text-grafite">{rec.texto}</p>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="mt-8" aria-labelledby="detalhe">
              <h2 id="detalhe" className="text-lg font-bold text-grafite">
                Todas as habilidades praticadas
              </h2>
              {disciplinas.map((d) => (
                <div key={d} className="mt-4 break-inside-avoid">
                  <h3 className="text-sm font-semibold tracking-wide text-pedra uppercase">{d}</h3>
                  <table className="mt-1 w-full table-fixed text-sm">
                    <colgroup>
                      <col />
                      <col className="w-28" />
                      <col className="w-24" />
                      <col className="w-12" />
                    </colgroup>
                    <thead className="sr-only">
                      <tr>
                        <th>Habilidade</th>
                        <th>Situação</th>
                        <th>Média recente</th>
                        <th>Evolução</th>
                      </tr>
                    </thead>
                    <tbody>
                      {praticadas
                        .filter((h) => h.disciplina === d)
                        .map((h) => (
                          <Linha key={h.habilidadeId} h={h} ev={evolucao(porHab.get(h.habilidadeId))} />
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="mt-10 border-t pt-4 text-xs text-pedra">
          Situação calculada pelo modelo de diagnóstico da Trilha a partir das atividades feitas (0 a 100 por dia) e revisada
          pela professora. Média recente = últimos 3 dias com atividade. É um apoio à conversa, não uma nota.
        </footer>
      </article>
    </div>
  );
}

function Linha({ h, ev }: { h: HabilidadeStatus; ev: ReturnType<typeof evolucao> }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-3 text-grafite">
        {h.nome}
        {h.codigoBncc && <span className="ml-1 text-xs text-pedra">({h.codigoBncc})</span>}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-grafite">
          <Marcas status={h.status} />
          {rotuloStatus(h.status)}
        </span>
      </td>
      <td className="py-2 pr-3 text-right whitespace-nowrap text-grafite tabular-nums">{ev ? `${ev.recente} de 100` : "—"}</td>
      <td className="py-2 text-right whitespace-nowrap text-pedra tabular-nums">
        {ev?.variacao == null ? "" : ev.variacao > 0 ? `+${ev.variacao}` : ev.variacao}
      </td>
    </tr>
  );
}
