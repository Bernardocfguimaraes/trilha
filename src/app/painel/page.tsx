import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { StatusSelo, rotuloStatus } from "@/components/marca";
import { api } from "@/lib/api";
import { dataCurta } from "@/lib/formato";
import { getProfessor } from "@/lib/auth";
import type { AlunoResumo, HabilidadeStatus, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Alunos" };

const PESO: Record<Status, number> = { alerta: 100, atencao: 1, ok: 0 };
const gravidade = (a: AlunoResumo) => a.habilidades.reduce((s, h) => s + PESO[h.status], 0);
const conta = (a: AlunoResumo, s: Status) => a.habilidades.filter((h) => h.status === s).length;

const FILTROS = [
  { valor: undefined, rotulo: "Todos" },
  { valor: "alerta", rotulo: "Com alerta" },
  { valor: "atencao", rotulo: "Com atenção" },
] as const;

export default async function PainelPage({ searchParams }: PageProps<"/painel">) {
  const { filtro } = await searchParams;
  const usuario = await getProfessor();
  const todos = await api.alunos(usuario.token);

  const ordenados = [...todos].sort((a, b) => gravidade(b) - gravidade(a) || a.nome.localeCompare(b.nome));
  const alunos =
    filtro === "alerta" || filtro === "atencao"
      ? ordenados.filter((a) => conta(a, filtro) > 0)
      : ordenados;

  const comAlerta = todos.filter((a) => conta(a, "alerta") > 0).length;
  const comAtencao = todos.filter((a) => conta(a, "alerta") === 0 && conta(a, "atencao") > 0).length;

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="text-3xl font-bold text-grafite">{todos[0]?.turma ?? "Sua turma"}</h1>
        <p className="mt-2 max-w-prose text-lg text-pedra">
          {comAlerta === 0 && comAtencao === 0
            ? "Nenhum aluno com habilidades em alerta ou atenção."
            : [
                comAlerta > 0 && `${comAlerta} ${comAlerta === 1 ? "aluno tem" : "alunos têm"} habilidades em alerta`,
                comAtencao > 0 && `${comAtencao} ${comAtencao === 1 ? "tem" : "têm"} pontos de atenção`,
              ]
                .filter(Boolean)
                .join(" e ") + "."}
        </p>
        <Link
          href="/painel/conversa"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-mata outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <MessagesSquare className="size-4" />
          Perguntar sobre a turma
        </Link>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav className="flex gap-1 rounded-lg bg-secondary p-1" aria-label="Filtrar alunos">
          {FILTROS.map((f) => {
            const ativo = filtro === f.valor || (!f.valor && filtro !== "alerta" && filtro !== "atencao");
            return (
              <Link
                key={f.rotulo}
                href={f.valor ? `/painel?filtro=${f.valor}` : "/painel"}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  ativo ? "bg-white text-grafite shadow-sm" : "text-pedra hover:text-grafite",
                )}
              >
                {f.rotulo}
              </Link>
            );
          })}
        </nav>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-pedra" aria-label="Legenda">
          {LEGENDA.map((l) => (
            <li key={l.rotulo} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-4 rounded-sm", l.cor)} aria-hidden />
              {l.rotulo}
            </li>
          ))}
        </ul>
      </div>

      {alunos.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-white p-6 text-pedra">
          Nenhum aluno neste filtro.{" "}
          <Link href="/painel" className="font-semibold text-mata underline-offset-4 hover:underline">
            Ver todos os alunos
          </Link>
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {alunos.map((a, i) => (
            <li
              key={a.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-300"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <CartaoAluno aluno={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Cores dos segmentos: uma por situação da habilidade. "Ainda não chegou" é a etapa do
// caminho BNCC que o aluno ainda não alcançou (não conta como problema).
const COR_SEGMENTO: Record<Status | "nova", string> = {
  ok: "bg-mata",
  atencao: "bg-atencao",
  alerta: "bg-alerta",
  nova: "bg-border",
};

const LEGENDA = [
  { rotulo: "Ok", cor: COR_SEGMENTO.ok },
  { rotulo: "Atenção", cor: COR_SEGMENTO.atencao },
  { rotulo: "Alerta", cor: COR_SEGMENTO.alerta },
  { rotulo: "Ainda não chegou", cor: COR_SEGMENTO.nova },
];

const situacao = (h: HabilidadeStatus) => (h.iniciada ? h.status : "nova");

function porDisciplina(habilidades: HabilidadeStatus[]) {
  const grupos = new Map<string, HabilidadeStatus[]>();
  for (const h of habilidades) grupos.set(h.disciplina, [...(grupos.get(h.disciplina) ?? []), h]);
  return [...grupos].map(([nome, hs]) => ({ nome, habilidades: hs }));
}

function resumoDisciplina(hs: HabilidadeStatus[]): { texto: string; classe: string } {
  const iniciadas = hs.filter((h) => h.iniciada);
  const alertas = iniciadas.filter((h) => h.status === "alerta").length;
  const atencoes = iniciadas.filter((h) => h.status === "atencao").length;
  if (alertas) return { texto: `${alertas} em alerta`, classe: "text-alerta" };
  if (atencoes) return { texto: `${atencoes} em atenção`, classe: "text-[#7a4f12]" };
  if (!iniciadas.length) return { texto: "Não começou", classe: "text-pedra" };
  return { texto: "Em dia", classe: "text-mata" };
}

/**
 * Um cartão por aluno: cada disciplina vira uma barra com um segmento por habilidade,
 * na ordem do caminho. Dá para ver de relance onde está o problema sem rolar para o lado,
 * e o nome de cada habilidade aparece ao passar o mouse (e para o leitor de tela).
 */
function CartaoAluno({ aluno }: { aluno: AlunoResumo }) {
  const disciplinas = porDisciplina(aluno.habilidades);
  const precisam = aluno.habilidades
    .filter((h) => h.iniciada && h.status !== "ok")
    .sort((a, b) => PESO[b.status] - PESO[a.status]);
  const pior: Status | null = precisam[0]?.status ?? null;
  const visiveis = precisam.slice(0, 3);

  return (
    <Link
      href={`/painel/alunos/${aluno.id}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-white p-5 outline-none transition-[border-color,box-shadow,transform] duration-200",
        "border-l-4 hover:-translate-y-0.5 hover:border-mata/40 hover:shadow-[0_4px_16px_rgb(30_42_37/0.08)] focus-visible:ring-3 focus-visible:ring-ring/50",
        pior === "alerta" ? "border-l-alerta" : pior === "atencao" ? "border-l-atencao" : "border-l-mata",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-grafite group-hover:text-mata">{aluno.nome}</h2>
          <p className="text-sm text-pedra">
            {aluno.ultimaAtividade ? `Última atividade em ${dataCurta(aluno.ultimaAtividade)}` : "Ainda não fez atividades"}
          </p>
        </div>
        {pior ? (
          <StatusSelo status={pior} className="shrink-0 text-xs" />
        ) : !aluno.ultimaAtividade ? (
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-pedra">Sem atividades</span>
        ) : (
          <span className="shrink-0 rounded-md bg-mata-clara px-2 py-1 text-xs font-semibold text-mata-escura">Em dia</span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2.5 text-sm">
        {disciplinas.map((d) => {
          const resumo = resumoDisciplina(d.habilidades);
          return (
            <div key={d.nome} className="contents">
              <dt className="font-medium text-grafite">{d.nome}</dt>
              <dd className="flex h-2.5 min-w-0 animate-cresce gap-[3px]" style={{ animationDelay: "150ms" }} aria-hidden>
                {d.habilidades.map((h) => (
                  <span
                    key={h.habilidadeId}
                    title={`${h.nome}: ${h.iniciada ? rotuloStatus(h.status) : "ainda não chegou nesta etapa"}`}
                    className={cn("h-full flex-1 rounded-sm", COR_SEGMENTO[situacao(h)])}
                  />
                ))}
              </dd>
              <dd className={cn("text-right text-xs font-semibold whitespace-nowrap", resumo.classe)}>
                {resumo.texto}
                <span className="sr-only">
                  {" "}
                  ({d.habilidades.filter((h) => h.iniciada && h.status === "ok").length} de {d.habilidades.length}{" "}
                  habilidades ok)
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      {visiveis.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-semibold tracking-wide text-pedra uppercase">Precisa de apoio em</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {visiveis.map((h) => (
              <li
                key={h.habilidadeId}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  h.status === "alerta" ? "bg-alerta-clara text-alerta" : "bg-atencao-clara text-[#7a4f12]",
                )}
              >
                {h.nome}
                <span className="sr-only"> ({rotuloStatus(h.status).toLowerCase()})</span>
              </li>
            ))}
            {precisam.length > visiveis.length && (
              <li className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-pedra">
                +{precisam.length - visiveis.length}
              </li>
            )}
          </ul>
        </div>
      )}
    </Link>
  );
}
