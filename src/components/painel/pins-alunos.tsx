"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AlunoCadastro } from "@/lib/types";
import { cn } from "@/lib/utils";

/** PINs que cada aluno digita para entrar. Ocultos por padrão (a tela pode estar no projetor). */
export function PinsAlunos({ alunos: iniciais, token }: { alunos: AlunoCadastro[]; token: string | null }) {
  const [alunos, setAlunos] = useState(iniciais);
  const [visiveis, setVisiveis] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [novo, setNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function regenerar(aluno: AlunoCadastro) {
    setGerando(aluno.id);
    setErro(null);
    try {
      const atualizado = await api.regenerarPin(aluno.id, token);
      setAlunos((lista) => lista.map((a) => (a.id === atualizado.id ? atualizado : a)));
      setNovo(atualizado.id);
    } catch {
      setErro(aluno.id);
    } finally {
      setGerando(null);
    }
  }

  return (
    <section aria-labelledby="pins" className="rounded-lg border bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="pins" className="text-lg font-bold text-grafite">
            PIN dos alunos
          </h2>
          <p className="mt-0.5 max-w-prose text-sm text-pedra">
            Depois de escolher o nome, cada aluno confirma quem é com estes 4 números.
          </p>
        </div>
        <Button variant="outline" onClick={() => setVisiveis((v) => !v)} className="h-9 px-3">
          {visiveis ? <EyeOff /> : <Eye />}
          {visiveis ? "Ocultar PINs" : "Mostrar PINs"}
        </Button>
      </header>
      <ul className="divide-y">
        {alunos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
            <span className="font-semibold text-grafite">{a.nome}</span>
            <span className="flex items-center gap-4">
              <span
                className={cn(
                  "w-16 text-right font-mono text-lg tracking-[0.2em] tabular-nums",
                  novo === a.id ? "font-bold text-mata" : "text-grafite",
                )}
                aria-label={visiveis ? `PIN ${a.pin.split("").join(" ")}` : "PIN oculto"}
              >
                {visiveis ? a.pin : "••••"}
              </span>
              <Button
                variant="ghost"
                onClick={() => regenerar(a)}
                disabled={gerando === a.id}
                className="h-9 px-3 text-pedra"
                aria-label={`Gerar novo PIN para ${a.nome}`}
              >
                <RefreshCw className={cn(gerando === a.id && "animate-spin")} />
                Gerar novo
              </Button>
            </span>
            {novo === a.id && (
              <p role="status" className="w-full text-sm text-mata">
                Novo PIN gerado{visiveis ? "" : " (clique em Mostrar PINs para ver)"}. O anterior deixou de funcionar.
              </p>
            )}
            {erro === a.id && (
              <p role="alert" className="w-full text-sm font-semibold text-alerta">
                Não foi possível gerar um novo PIN. Tente de novo.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
