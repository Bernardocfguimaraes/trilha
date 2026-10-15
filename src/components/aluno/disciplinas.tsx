import { BookOpen, Calculator, FlaskConical, Globe, Languages, Sparkles, type LucideIcon } from "lucide-react";
import type { DisciplinaPublica } from "@/lib/types";
import { cn } from "@/lib/utils";

// Cor e ícone de cada disciplina no lado do aluno (por id do contrato).
const VISUAL: Record<string, { icone: LucideIcon; cartao: string; frase: string }> = {
  por: { icone: BookOpen, cartao: "bg-coral text-white shadow-[0_6px_0_#d9583a]", frase: "Ler e escrever" },
  mat: { icone: Calculator, cartao: "bg-sol text-grafite shadow-[0_6px_0_var(--color-sol-escuro)]", frase: "Contas e números" },
  geo: { icone: Globe, cartao: "bg-[#4bb3e6] text-white shadow-[0_6px_0_#2a8fc4]", frase: "Mapas e lugares" },
  cie: { icone: FlaskConical, cartao: "bg-broto text-white shadow-[0_6px_0_var(--color-broto-escuro)]", frase: "Bichos, plantas e água" },
  ing: { icone: Languages, cartao: "bg-[#9b7fe6] text-white shadow-[0_6px_0_#7a5fc4]", frase: "Palavras em inglês" },
};

const PADRAO = { icone: Sparkles, cartao: "bg-white text-grafite shadow-[0_6px_0_var(--color-ceu-forte)]", frase: "" };

export const visualDisciplina = (id: string) => VISUAL[id] ?? PADRAO;

export function CartaoDisciplina({
  disciplina,
  onEscolher,
  desabilitado,
}: {
  disciplina: DisciplinaPublica;
  onEscolher: () => void;
  desabilitado?: boolean;
}) {
  const { icone: Icone, cartao, frase } = visualDisciplina(disciplina.id);
  return (
    <button
      onClick={onEscolher}
      disabled={desabilitado}
      className={cn(
        "flex min-h-28 w-full items-center gap-4 rounded-3xl px-5 py-4 text-left outline-none",
        "transition-[transform,box-shadow] duration-75 focus-visible:ring-4 focus-visible:ring-grafite/40",
        "active:translate-y-[6px] active:shadow-none disabled:opacity-60",
        cartao,
      )}
    >
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/25" aria-hidden>
        <Icone className="size-9" strokeWidth={2.5} />
      </span>
      <span>
        <span className="block font-display text-3xl leading-none font-extrabold">{disciplina.nome}</span>
        {frase && <span className="mt-1 block font-display text-lg font-semibold opacity-90">{frase}</span>}
      </span>
    </button>
  );
}

export function IconeDisciplina({ id, className }: { id: string; className?: string }) {
  const { icone: Icone, cartao } = visualDisciplina(id);
  return (
    <span className={cn("grid place-items-center rounded-3xl", cartao, className)} aria-hidden>
      <Icone className="size-1/2" strokeWidth={2.5} />
    </span>
  );
}
