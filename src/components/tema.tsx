"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { CHAVE_TEMA } from "@/lib/tema";
import { cn } from "@/lib/utils";

function assinar(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  // Sem escolha salva, acompanha a troca de tema do sistema.
  const sistema = matchMedia("(prefers-color-scheme: dark)");
  const aoMudarSistema = (e: MediaQueryListEvent) => {
    let salvo: string | null = null;
    try {
      salvo = localStorage.getItem(CHAVE_TEMA);
    } catch {}
    if (!salvo) document.documentElement.classList.toggle("dark", e.matches);
  };
  sistema.addEventListener("change", aoMudarSistema);
  return () => {
    observador.disconnect();
    sistema.removeEventListener("change", aoMudarSistema);
  };
}

const lerEscuro = () => document.documentElement.classList.contains("dark");

/** Botão de alternar tema. `variante="aluno"` usa o alvo grande e redondo das telas infantis. */
export function BotaoTema({ variante = "adulto", className }: { variante?: "adulto" | "aluno"; className?: string }) {
  const escuro = useSyncExternalStore(assinar, lerEscuro, () => false);

  function alternar() {
    const novo = !escuro;
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem(CHAVE_TEMA, novo ? "escuro" : "claro");
    } catch {}
  }

  const Icone = escuro ? Sun : Moon;
  const rotulo = escuro ? "Usar modo claro" : "Usar modo escuro";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        "grid shrink-0 place-items-center rounded-full outline-none transition-colors",
        variante === "aluno"
          ? "size-11 text-pedra hover:bg-superficie/70 focus-visible:ring-4 focus-visible:ring-grafite/30"
          : "size-9 text-pedra hover:bg-secondary hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Icone className={variante === "aluno" ? "size-6" : "size-[18px]"} strokeWidth={variante === "aluno" ? 2.5 : 2} aria-hidden />
    </button>
  );
}
