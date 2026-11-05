"use client";

import { useState } from "react";
import { Eye, EyeOff, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AlunoCadastro } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Alunos da turma e o PIN de cada um (ocultos por padrão: a tela pode estar no projetor).
 * Também é aqui que o professor cadastra alunos novos. */
export function PinsAlunos({ turmaId, alunos: iniciais }: { turmaId: string; alunos: AlunoCadastro[] }) {
  const [alunos, setAlunos] = useState(iniciais);
  const [visiveis, setVisiveis] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [novo, setNovo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erroNovo, setErroNovo] = useState(false);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = nome.trim().replace(/\s+/g, " ");
    if (limpo.length < 2) return;
    setAdicionando(true);
    setErroNovo(false);
    try {
      const criado = await api.adicionarAluno(turmaId, limpo);
      setAlunos((lista) => [...lista, criado].sort((a, b) => a.nome.localeCompare(b.nome)));
      setNovo(criado.id);
      setNome("");
    } catch {
      setErroNovo(true);
    } finally {
      setAdicionando(false);
    }
  }

  async function regenerar(aluno: AlunoCadastro) {
    setGerando(aluno.id);
    setErro(null);
    try {
      const atualizado = await api.regenerarPin(aluno.id);
      setAlunos((lista) => lista.map((a) => (a.id === atualizado.id ? atualizado : a)));
      setNovo(atualizado.id);
    } catch {
      setErro(aluno.id);
    } finally {
      setGerando(null);
    }
  }

  return (
    <section id="alunos" aria-labelledby="pins" className="scroll-mt-6 rounded-lg border bg-superficie">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="pins" className="text-lg font-bold text-grafite">
            Alunos e PINs
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
      {alunos.length === 0 && <p className="px-5 py-4 text-pedra">Nenhum aluno ainda. Cadastre o primeiro abaixo.</p>}
      <ul className="divide-y empty:hidden">
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
                PIN pronto{visiveis ? "" : " (clique em Mostrar PINs para ver)"}. Se havia um anterior, ele deixou de funcionar.
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
      <form onSubmit={adicionar} className="flex flex-wrap items-end gap-3 border-t px-5 py-4">
        <div className="min-w-0 flex-1">
          <label htmlFor="novo-aluno" className="text-sm font-semibold text-grafite">
            Adicionar aluno
          </label>
          <input
            id="novo-aluno"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome e sobrenome"
            maxLength={80}
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-lg border border-input bg-superficie px-3 text-grafite outline-none placeholder:text-pedra/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <Button type="submit" disabled={adicionando || nome.trim().length < 2} className="h-10 px-4">
          <UserPlus />
          {adicionando ? "Adicionando…" : "Adicionar"}
        </Button>
        {erroNovo && (
          <p role="alert" className="w-full text-sm font-semibold text-alerta">
            Não foi possível adicionar agora. Tente de novo.
          </p>
        )}
      </form>
    </section>
  );
}
