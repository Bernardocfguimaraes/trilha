"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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
