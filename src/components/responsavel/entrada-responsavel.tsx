"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LinkVoltar } from "@/components/voltar";
import { buttonVariants } from "@/components/ui/button";
import type { AlunoPublico, TurmaPublica } from "@/lib/types";
import { cn } from "@/lib/utils";

type Erro = "errado" | "bloqueado" | "rede" | null;

const MENSAGENS: Record<Exclude<Erro, null>, string> = {
  errado: "PIN incorreto. Confira com a criança ou com o professor.",
  bloqueado: "Muitas tentativas erradas. Espere um minuto e tente de novo.",
  rede: "Não foi possível conferir agora. Tente de novo.",
};

/** Escolhe o filho na lista da turma e confirma com o PIN dele. */
export function EntradaResponsavel({ turma }: { turma: TurmaPublica }) {
  const router = useRouter();
  const [aluno, setAluno] = useState<AlunoPublico | null>(null);
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<Erro>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!aluno || pin.length !== 4) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/responsavel/sessao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alunoId: aluno.id, pin }),
      });
      const r = (await res.json()) as { valido: boolean; bloqueado: boolean };
      if (r.valido) {
        router.replace("/responsavel/progresso");
        return;
      }
      setErro(res.ok ? (r.bloqueado ? "bloqueado" : "errado") : "rede");
    } catch {
      setErro("rede");
    }
    setPin("");
    setEnviando(false);
  }

  if (!aluno) {
    return (
      <>
        <LinkVoltar href="/responsavel" className="mt-4 self-start">
          Trocar código da turma
        </LinkVoltar>
        <main className="mx-auto w-full max-w-lg flex-1 py-10 animate-in fade-in duration-300">
          <p className="text-sm font-semibold text-pedra">Turma {turma.nome}</p>
          <h1 className="mt-1 text-3xl font-bold text-grafite">Quem é a sua criança?</h1>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {turma.alunos.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setAluno(a)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-superficie px-4 py-3 text-left font-semibold text-grafite outline-none transition-[border-color,box-shadow] hover:border-mata/50 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mata-clara text-mata-escura" aria-hidden>
                    {a.nome[0]}
                  </span>
                  {a.nome}
                </button>
              </li>
            ))}
          </ul>
        </main>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setAluno(null);
          setPin("");
          setErro(null);
        }}
        className="mt-4 inline-flex items-center gap-1.5 self-start rounded-md text-sm font-semibold text-pedra outline-none hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Escolher outra criança
      </button>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-in fade-in duration-300">
        <h1 className="text-3xl font-bold text-grafite">PIN de {aluno.nome.split(" ")[0]}</h1>
        <p className="mt-2 text-pedra">
          São os 4 números que a criança usa para entrar na trilha. Se não souber, peça ao professor.
        </p>
        <form onSubmit={entrar} className="mt-8">
          <label htmlFor="pin" className="block text-sm font-semibold text-grafite">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            aria-invalid={!!erro}
            aria-describedby={erro ? "erro-pin" : undefined}
            className="mt-1.5 h-12 w-40 rounded-lg border border-input bg-superficie px-3 text-center text-2xl font-semibold tracking-[0.5em] text-grafite outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-alerta"
          />
          <p id="erro-pin" role="alert" className="mt-3 min-h-5 text-sm font-semibold text-alerta">
            {erro && MENSAGENS[erro]}
          </p>
          <button
            type="submit"
            disabled={pin.length !== 4 || enviando}
            className={cn(buttonVariants({ size: "lg" }), "mt-4 h-11 w-full text-base")}
          >
            {enviando ? "Conferindo…" : "Ver o progresso"}
          </button>
        </form>
      </main>
    </>
  );
}
