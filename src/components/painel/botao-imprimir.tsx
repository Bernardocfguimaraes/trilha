"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Imprime ou salva em PDF pelo diálogo do navegador (sem biblioteca de PDF). Durante a
 * impressão, o tema escuro é desligado (papel é claro), inclusive no Ctrl+P.
 */
export function BotaoImprimir() {
  useEffect(() => {
    const raiz = document.documentElement;
    let estavaEscuro = false;
    const antes = () => {
      estavaEscuro = raiz.classList.contains("dark");
      raiz.classList.remove("dark");
    };
    const depois = () => {
      if (estavaEscuro) raiz.classList.add("dark");
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
    };
  }, []);

  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer aria-hidden />
      Imprimir ou salvar PDF
    </Button>
  );
}
