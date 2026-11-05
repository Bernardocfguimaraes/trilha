import Link from "next/link";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { TurmaResumo } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Troca de turma na barra lateral. <details> abre e fecha sem JavaScript e com teclado;
 * cada turma é um formulário que grava a escolha (POST /api/turma-atual) e volta ao painel.
 */
export function SeletorTurma({ turmas, atual }: { turmas: TurmaResumo[]; atual: TurmaResumo | null }) {
  if (!atual) {
    return (
      <Link
        href="/painel/turmas/nova"
        className="flex items-center gap-2 rounded-lg border border-dashed border-mata/50 px-3 py-2.5 text-sm font-semibold text-mata outline-none hover:bg-mata-clara focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Plus className="size-4" aria-hidden />
        Criar primeira turma
      </Link>
    );
  }
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-3 rounded-lg border bg-papel px-3 py-2 outline-none hover:border-mata/40 focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
        aria-label={`Turma atual: ${atual.nome}. Trocar de turma`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-mata-clara font-display text-base font-extrabold text-mata-escura" aria-hidden>
          {atual.ano}º
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-grafite">{atual.nome}</span>
          <span className="block text-xs text-pedra">
            {atual.alunos} {atual.alunos === 1 ? "aluno" : "alunos"}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-pedra transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border bg-superficie p-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
        <ul>
          {turmas.map((t) => (
            <li key={t.id}>
              <form action="/api/turma-atual" method="post">
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  aria-current={t.id === atual.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50",
                    t.id === atual.id ? "font-bold text-grafite" : "text-grafite",
                  )}
                >
                  <span className="w-7 shrink-0 font-display font-extrabold text-pedra">{t.ano}º</span>
                  <span className="min-w-0 flex-1 truncate">{t.nome}</span>
                  {t.id === atual.id && <Check className="size-4 text-mata" aria-hidden />}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <Link
          href="/painel/turmas/nova"
          className="mt-1 flex items-center gap-2 border-t px-2.5 pt-2.5 pb-2 text-sm font-semibold text-mata outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" aria-hidden />
          Nova turma
        </Link>
      </div>
    </details>
  );
}
