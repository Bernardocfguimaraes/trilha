import type { Metadata } from "next";
import Link from "next/link";
import { Marcas, StatusSelo, rotuloStatus } from "@/components/marca";
import { api } from "@/lib/api";
import { dataCurta } from "@/lib/formato";
import { getUsuario } from "@/lib/supabase/server";
import type { AlunoResumo, Status } from "@/lib/types";
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
  const usuario = await getUsuario();
  const todos = await api.alunos(usuario?.token);

  const ordenados = [...todos].sort((a, b) => gravidade(b) - gravidade(a) || a.nome.localeCompare(b.nome));
  const alunos =
    filtro === "alerta" || filtro === "atencao"
      ? ordenados.filter((a) => conta(a, filtro) > 0)
      : ordenados;

  const comAlerta = todos.filter((a) => conta(a, "alerta") > 0).length;
  const comAtencao = todos.filter((a) => conta(a, "alerta") === 0 && conta(a, "atencao") > 0).length;
  const professor = usuario?.papel === "professor";

  // Colunas agrupadas por disciplina, na ordem em que a API envia
  const colunas = todos[0]?.habilidades ?? [];
  const disciplinas = colunas.reduce<{ nome: string; total: number }[]>((acc, h) => {
    const ultima = acc.at(-1);
    if (ultima?.nome === h.disciplina) ultima.total++;
    else acc.push({ nome: h.disciplina, total: 1 });
    return acc;
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="text-3xl font-bold text-grafite">{professor ? todos[0]?.turma ?? "Sua turma" : "Acompanhamento"}</h1>
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
        <ul className="flex flex-wrap gap-2" aria-label="Legenda">
          {(["ok", "atencao", "alerta"] as Status[]).map((s) => (
            <li key={s}>
              <StatusSelo status={s} className="text-xs" />
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
        <>
          {/* Matriz aluno × habilidade (telas médias e grandes) */}
          <div className="mt-4 hidden overflow-x-auto rounded-lg border bg-white md:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b">
                  <th rowSpan={2} className="px-4 py-3 align-bottom text-sm font-semibold text-pedra">
                    Aluno
                  </th>
                  {disciplinas.map((d) => (
                    <th key={d.nome} colSpan={d.total} className="border-l px-3 pt-3 pb-1 text-sm font-semibold text-grafite">
                      {d.nome}
                    </th>
                  ))}
                  <th rowSpan={2} className="border-l px-4 py-3 align-bottom text-sm font-semibold text-pedra">
                    Última atividade
                  </th>
                </tr>
                <tr className="border-b">
                  {colunas.map((h, i) => (
                    <th
                      key={h.habilidadeId}
                      className={cn(
                        "w-24 px-3 pb-3 align-bottom text-xs leading-tight font-normal text-pedra",
                        (i === 0 || colunas[i - 1].disciplina !== h.disciplina) && "border-l",
                      )}
                    >
                      {h.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alunos.map((a) => (
                  <tr key={a.id} className="group relative border-b last:border-b-0 hover:bg-papel">
                    <th scope="row" className="px-4 py-3 font-semibold text-grafite">
                      <Link
                        href={`/painel/alunos/${a.id}`}
                        className="outline-none after:absolute after:inset-0 group-hover:text-mata focus-visible:underline"
                      >
                        {a.nome}
                      </Link>
                    </th>
                    {a.habilidades.map((h, i) => (
                      <td
                        key={h.habilidadeId}
                        className={cn(
                          "px-3 py-3",
                          (i === 0 || a.habilidades[i - 1].disciplina !== h.disciplina) && "border-l",
                        )}
                        title={`${h.nome}: ${rotuloStatus(h.status)}`}
                      >
                        <Marcas status={h.status} />
                        <span className="sr-only">{rotuloStatus(h.status)}</span>
                      </td>
                    ))}
                    <td className="border-l px-4 py-3 text-sm whitespace-nowrap text-pedra">
                      {a.ultimaAtividade ? dataCurta(a.ultimaAtividade) : "Ainda não fez"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista (celular) */}
          <ul className="mt-4 divide-y rounded-lg border bg-white md:hidden">
            {alunos.map((a) => {
              const destaques = a.habilidades.filter((h) => h.status !== "ok");
              return (
                <li key={a.id}>
                  <Link href={`/painel/alunos/${a.id}`} className="block px-4 py-3 outline-none focus-visible:bg-papel">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-grafite">{a.nome}</span>
                      <span className="flex gap-2">
                        {a.habilidades.map((h) => (
                          <Marcas key={h.habilidadeId} status={h.status} />
                        ))}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-pedra">
                      {destaques.length === 0
                        ? "Tudo em dia"
                        : destaques.map((h) => `${h.nome} (${rotuloStatus(h.status).toLowerCase()})`).join(", ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
