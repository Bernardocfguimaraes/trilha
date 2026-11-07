"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/lib/api";
import type { Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROTULO: Record<Status, string> = { ok: "ok", atencao: "em atenção", alerta: "em alerta" };
const ORDEM: Status[] = ["ok", "atencao", "alerta"];

/**
 * "O diagnóstico está certo?": a resposta do professor vira um rótulo real, usado para medir
 * o modelo com dados da escola e retreiná-lo (ml/exportar_reais.py + ml/treinar.py).
 */
export function AvaliacaoDiagnostico({
  alunoId,
  habilidadeId,
  statusModelo,
  inicial,
}: {
  alunoId: string;
  habilidadeId: string;
  statusModelo: Status;
  inicial: Status | null;
}) {
  const [avaliacao, setAvaliacao] = useState<Status | null>(inicial);
  const [corrigindo, setCorrigindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);

  async function enviar(status: Status) {
    setEnviando(true);
    setErro(false);
    try {
      await api.avaliarDiagnostico(alunoId, habilidadeId, status);
      setAvaliacao(status);
      setCorrigindo(false);
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  }

  if (avaliacao && !corrigindo) {
    return (
      <p role="status" className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-mata-clara/60 px-3 py-2 text-xs text-grafite">
        <Check className="size-3.5 text-mata" aria-hidden />
        {avaliacao === statusModelo ? "Você confirmou o diagnóstico." : `Você avaliou como ${ROTULO[avaliacao]}.`}
        <span className="text-pedra">Isso ajuda a treinar o modelo.</span>
        <button type="button" onClick={() => setCorrigindo(true)} className="font-semibold text-mata underline-offset-4 hover:underline">
          Mudar
        </button>
      </p>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-dashed px-3 py-2">
      <p className="text-xs font-semibold text-grafite">O diagnóstico está certo?</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Avaliar o diagnóstico">
        <button
          type="button"
          disabled={enviando}
          onClick={() => enviar(statusModelo)}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Sim
        </button>
        {ORDEM.filter((s) => s !== statusModelo).map((s) => (
          <button
            key={s}
            type="button"
            disabled={enviando}
            onClick={() => enviar(s)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-semibold text-grafite outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
            )}
          >
            Não, está {ROTULO[s]}
          </button>
        ))}
      </div>
      {erro && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-alerta">
          Não foi possível salvar. Tente de novo.
        </p>
      )}
    </div>
  );
}
