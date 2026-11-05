"use client";

import type { Tocar } from "@/lib/tocar";
import { cn } from "@/lib/utils";
import { Brilhos } from "./trilha-progresso";

const COLADA = /^[^\s\p{L}]+/u;

interface Resultado {
  correta: boolean;
  opcaoCorretaId: string;
}

/**
 * "Toque na palavra": o texto aparece inteiro e as palavras que podem ser resposta ficam
 * marcadas com um sublinhado pontilhado. O aluno toca direto no texto; o feedback também
 * acontece ali (a certa ganha brilho, a errada balança). Teclado: Tab entre as palavras.
 */
export function QuestaoTocar({
  tocar,
  escolha,
  onEscolher,
  resultado,
}: {
  tocar: Tocar;
  escolha: string | null;
  onEscolher: (id: string) => void;
  resultado: Resultado | null;
}) {
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Palavras do texto que podem ser a resposta"
        className={cn(
          "mt-6 rounded-2xl border-[3px] bg-superficie px-5 py-5 font-display text-[1.65rem] leading-[1.9] font-semibold text-grafite",
          "transition-colors duration-200",
          !resultado && "border-transparent",
          resultado?.correta && "border-broto",
          resultado && !resultado.correta && "border-coral",
        )}
      >
        {tocar.pedacos.map((p, i) => {
          // Pontuação colada depois de uma palavra tocável vai junto com ela (abaixo), para
          // a linha nunca quebrar entre "cachorro" e ".".
          const anterior = tocar.pedacos[i - 1];
          const texto = anterior?.opcaoId ? p.texto.replace(COLADA, "") : p.texto;
          if (!p.opcaoId) return <span key={i}>{texto}</span>;
          const colada = COLADA.exec(tocar.pedacos[i + 1]?.texto ?? "")?.[0] ?? "";
          const id = p.opcaoId;
          const marcada = escolha === id;
          const certa = resultado?.opcaoCorretaId === id;
          const errada = !!resultado && marcada && !resultado.correta;
          return (
            <span key={i} className="whitespace-nowrap">
              <button
                type="button"
                role="radio"
                aria-checked={marcada}
                disabled={!!resultado}
                onClick={() => onEscolher(id)}
                className={cn(
                  "relative inline-block rounded-lg px-1 py-0.5 align-baseline leading-tight font-bold outline-none",
                  "transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-4 focus-visible:ring-agua/40",
                  !resultado && !marcada && "bg-ceu/70 underline decoration-agua/50 decoration-dotted decoration-[3px] underline-offset-[6px] hover:bg-ceu-forte",
                  marcada && !resultado && "bg-agua text-white shadow-[0_3px_0_var(--color-agua-escura)]",
                  certa && "animate-estoura bg-broto text-white shadow-[0_3px_0_var(--color-broto-escuro)]",
                  errada && "animate-balanca bg-coral text-white line-through decoration-white/80 decoration-[3px]",
                  resultado && !certa && !errada && "text-grafite/70",
                )}
              >
                {p.texto}
                {certa && resultado?.correta && <Brilhos />}
              </button>
              {colada}
            </span>
          );
        })}
      </div>
      <p className="mt-4 text-center font-display text-lg font-semibold text-pedra" aria-hidden={!!resultado}>
        {resultado ? " " : "Toque na palavra do texto"}
      </p>
    </>
  );
}
