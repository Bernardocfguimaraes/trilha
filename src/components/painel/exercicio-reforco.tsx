"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Exercicio, Nivel, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const NIVEIS: { id: Nivel; rotulo: string }[] = [
  { id: "facil", rotulo: "Fácil" },
  { id: "medio", rotulo: "Médio" },
  { id: "dificil", rotulo: "Difícil" },
];

const LETRA = ["A", "B", "C", "D"];

// Botão que gera um exercício de reforço para a habilidade, para o professor revisar antes
// de levar para a criança. O nível começa no fácil quando a habilidade está em alerta.
export function ExercicioReforco({ habilidadeId, status }: { habilidadeId: string; status: Status }) {
  const [nivel, setNivel] = useState<Nivel>(status === "alerta" ? "facil" : "medio");
  const [exercicio, setExercicio] = useState<Exercicio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function gerar() {
    if (carregando) return;
    setCarregando(true);
    setFalhou(false);
    try {
      setExercicio(await api.gerarExercicio(habilidadeId, nivel));
    } catch {
      setFalhou(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-pedra">Nível:</span>
        <div className="flex gap-1">
          {NIVEIS.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setNivel(n.id)}
              aria-pressed={nivel === n.id}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                nivel === n.id
                  ? "border-mata bg-mata-clara font-semibold text-mata"
                  : "border-input text-pedra hover:border-mata",
              )}
            >
              {n.rotulo}
            </button>
          ))}
        </div>
        <Button onClick={gerar} disabled={carregando} size="sm" className="ml-auto">
          <Sparkles />
          {carregando ? "Gerando…" : exercicio ? "Gerar outro" : "Gerar exercício"}
        </Button>
      </div>

      {falhou && (
        <p role="alert" className="mt-3 text-sm font-semibold text-alerta">
          Não foi possível gerar agora. Tente de novo.
        </p>
      )}

      {exercicio && !carregando && (
        <div className="mt-3 rounded-lg bg-secondary/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-grafite">{exercicio.enunciado}</p>
            <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs font-semibold text-pedra">
              {exercicio.origem === "ia" ? "Gerado por IA" : "Do banco"}
            </span>
          </div>
          {exercicio.apoio && (
            <p className="mt-2 text-2xl" aria-hidden>
              {exercicio.apoio}
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {exercicio.opcoes.map((o, i) => {
              const correta = i === exercicio.indiceCorreta;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-[0.9375rem] text-grafite",
                    correta ? "border-mata bg-mata-clara font-semibold" : "border-transparent bg-white",
                  )}
                >
                  <span className="text-pedra">{LETRA[i]})</span>
                  <span className="flex-1">{o}</span>
                  {correta && <Check className="size-4 text-mata" aria-label="resposta certa" />}
                </li>
              );
            })}
          </ul>
          {exercicio.explicacao && (
            <p className="mt-3 text-sm text-pedra">
              <span className="font-semibold">Por quê:</span> {exercicio.explicacao}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
