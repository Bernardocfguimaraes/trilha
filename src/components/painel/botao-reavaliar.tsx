"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Roda o modelo de diagnóstico de novo sobre todo o histórico da turma. */
export function BotaoReavaliar({ turmaId }: { turmaId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"parado" | "rodando" | "erro">("parado");
  const [resultado, setResultado] = useState<string | null>(null);

  async function reavaliar() {
    setEstado("rodando");
    setResultado(null);
    try {
      const r = await api.reavaliarTurma(turmaId);
      setResultado(
        r.reavaliados === 0
          ? "Ainda não há atividades para avaliar."
          : `${r.reavaliados} ${r.reavaliados === 1 ? "habilidade reavaliada" : "habilidades reavaliadas"} pelo modelo.`,
      );
      setEstado("parado");
      router.refresh();
    } catch {
      setEstado("erro");
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={reavaliar}
        disabled={estado === "rodando"}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-mata outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
      >
        <BrainCircuit className={cn("size-4", estado === "rodando" && "animate-pulse")} aria-hidden />
        {estado === "rodando" ? "Reavaliando…" : "Reavaliar turma com o modelo"}
      </button>
      <span role="status" className="text-sm text-pedra">
        {estado === "erro" ? "Não foi possível reavaliar agora. Tente de novo." : resultado}
      </span>
    </span>
  );
}
