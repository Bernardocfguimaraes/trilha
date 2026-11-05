"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Sabia } from "@/components/marca";
import { Brilhos } from "@/components/aluno/trilha-progresso";
import { cn } from "@/lib/utils";

const PECAS = ["joga", "jogam", "jogamos"] as const;
const CERTA = "jogam";

/**
 * Uma pergunta de verdade na página inicial: quem visita experimenta a trilha antes de
 * entrar. Mesmo visual e mesmo feedback das telas do aluno.
 */
export function DemoQuestao() {
  const [escolha, setEscolha] = useState<string | null>(null);
  const acertou = escolha === CERTA;

  return (
    <div className="relative rounded-[1.75rem] bg-superficie p-5 shadow-[0_6px_0_var(--color-ceu-forte)] ring-2 ring-ceu-forte sm:p-6">
      <div className="flex items-start gap-3">
        <span key={escolha ?? "pensando"} className={cn("shrink-0", acertou && "animate-pulo")}>
          <Sabia humor={escolha ? (acertou ? "festa" : "triste") : "pensando"} className="size-16" />
        </span>
        <div className="relative mt-1 flex-1 rounded-2xl bg-ceu px-4 py-3">
          <span className="absolute top-5 -left-1.5 size-3 rotate-45 bg-ceu" aria-hidden />
          <p className="relative font-display text-xl leading-snug font-bold text-grafite">Complete a frase.</p>
        </div>
      </div>

      <p className="mt-5 font-display text-[1.7rem] leading-[1.8] font-bold text-grafite" aria-live="polite">
        Os meninos{" "}
        {escolha ? (
          <span
            key={escolha}
            className={cn(
              "relative inline-block rounded-xl border-[3px] px-2 leading-tight",
              acertou ? "animate-estoura border-broto bg-broto-clara" : "animate-balanca border-coral bg-coral-claro",
            )}
          >
            {escolha}
            {acertou && <Brilhos />}
          </span>
        ) : (
          <span className="inline-block h-[1.15em] w-[4.5ch] translate-y-[0.2em] rounded-lg border-[3px] border-dashed border-agua/60 bg-ceu/60" />
        )}{" "}
        bola no recreio.
        <span className="sr-only">{escolha ? "" : " (lacuna)"}</span>
      </p>

      <div role="radiogroup" aria-label="Peças para completar a frase" className="mt-4 flex flex-wrap gap-2.5">
        {PECAS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={escolha === p}
            disabled={!!escolha}
            onClick={() => setEscolha(p)}
            className={cn(
              "min-h-12 rounded-2xl border-[3px] px-4 font-display text-xl font-bold text-grafite outline-none",
              "transition-[transform,box-shadow,opacity] duration-100 focus-visible:ring-4 focus-visible:ring-grafite/30",
              escolha === p
                ? "border-dashed border-ceu-forte bg-transparent text-transparent"
                : "border-ceu-forte bg-superficie shadow-[0_4px_0_var(--color-ceu-forte)] active:translate-y-1 active:shadow-none",
              escolha && escolha !== p && "opacity-50",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-4 flex min-h-11 items-center justify-between gap-3" role="status">
        {escolha ? (
          <>
            <p className={cn("font-display text-lg leading-snug font-bold", acertou ? "text-broto-escuro dark:text-mata" : "text-coral-escuro dark:text-coral")}>
              {acertou ? "Isso! “Os meninos” pede o verbo no plural." : "Quase! São vários meninos: o verbo vai para o plural."}
            </p>
            <button
              type="button"
              onClick={() => setEscolha(null)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-display text-base font-semibold text-pedra outline-none hover:bg-ceu focus-visible:ring-4 focus-visible:ring-grafite/30"
            >
              <RotateCcw className="size-4" aria-hidden />
              De novo
            </button>
          </>
        ) : (
          <p className="font-display text-base font-semibold text-pedra">Toque numa peça para completar.</p>
        )}
      </div>
    </div>
  );
}
