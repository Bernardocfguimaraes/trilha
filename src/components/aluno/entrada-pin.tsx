"use client";

import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const TAMANHO = 4;
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "apagar"] as const;

/**
 * Número secreto de 4 dígitos, com teclado grande na tela (e o teclado físico também vale).
 * Envia sozinho ao completar. Para limpar depois de um erro, o pai troca a `key`.
 */
export function EntradaPin({
  onCompleto,
  desabilitado,
  errou,
}: {
  onCompleto: (pin: string) => void;
  desabilitado?: boolean;
  errou?: boolean;
}) {
  const [digitos, setDigitos] = useState("");

  function teclar(t: string) {
    if (desabilitado) return;
    if (t === "apagar") return setDigitos((d) => d.slice(0, -1));
    if (digitos.length >= TAMANHO) return;
    const novo = digitos + t;
    setDigitos(novo);
    if (novo.length === TAMANHO) onCompleto(novo);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) teclar(e.key);
      else if (e.key === "Backspace") teclar("apagar");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex w-full max-w-xs flex-col items-center">
      <div
        className={cn("flex gap-3", errou && "animate-balanca")}
        role="status"
        aria-label={`${digitos.length} de ${TAMANHO} números digitados`}
      >
        {Array.from({ length: TAMANHO }, (_, i) => (
          <span
            key={i}
            className={cn(
              "grid size-16 place-items-center rounded-2xl border-[3px] bg-white transition-colors",
              errou ? "border-coral" : i < digitos.length ? "border-[#2a8fc4]" : "border-ceu-forte",
            )}
          >
            {i < digitos.length && <span className="size-5 rounded-full bg-grafite" />}
          </span>
        ))}
      </div>

      <div className="mt-8 grid w-full grid-cols-3 gap-3">
        {TECLAS.map((t, i) =>
          t === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => teclar(t)}
              disabled={desabilitado}
              aria-label={t === "apagar" ? "Apagar" : t}
              className={cn(
                "grid h-16 place-items-center rounded-2xl bg-white font-display text-3xl font-bold text-grafite",
                "shadow-[0_4px_0_var(--color-ceu-forte)] ring-2 ring-ceu-forte transition-transform duration-75",
                "outline-none focus-visible:ring-4 focus-visible:ring-grafite/40 active:translate-y-1 active:shadow-none",
                "disabled:opacity-50",
              )}
            >
              {t === "apagar" ? <Delete className="size-8" strokeWidth={2.5} /> : t}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
