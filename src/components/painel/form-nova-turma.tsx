"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AnoDisponivel } from "@/lib/types";
import { cn } from "@/lib/utils";

const TODOS_ANOS = [4, 5, 6, 7, 8, 9];

export function FormNovaTurma({ anos }: { anos: AnoDisponivel[] }) {
  const router = useRouter();
  const disponiveis = new Map(anos.map((a) => [a.ano, a]));
  const [ano, setAno] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [nomeTocado, setNomeTocado] = useState(false);
  const [alunos, setAlunos] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const listaAlunos = alunos
    .split("\n")
    .map((n) => n.trim().replace(/\s+/g, " "))
    .filter((n) => n.length >= 2);

  function escolherAno(a: number) {
    setAno(a);
    // Sugere o nome enquanto o professor não escreveu o dele.
    if (!nomeTocado) setNome(`${a}º ano A`);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!ano || !nome.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const turma = await api.criarTurma({ nome: nome.trim(), ano, alunos: listaAlunos });
      await fetch("/api/turma-atual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: turma.id }),
      });
      router.push("/painel/turma");
      router.refresh();
    } catch {
      setErro("Não foi possível criar a turma agora. Confira os dados e tente de novo.");
      setEnviando(false);
    }
  }

  const escolhido = ano ? disponiveis.get(ano) : null;

  return (
    <form onSubmit={criar} className="mt-8 space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold text-grafite">Ano</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {TODOS_ANOS.map((a) => {
            const pronto = disponiveis.has(a);
            return (
              <label
                key={a}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center rounded-lg border-2 px-2 py-3 text-center outline-none transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  !pronto && "cursor-not-allowed opacity-50",
                  ano === a ? "border-mata bg-mata-clara" : "border-border bg-superficie hover:border-mata/40",
                )}
              >
                <input
                  type="radio"
                  name="ano"
                  value={a}
                  disabled={!pronto}
                  checked={ano === a}
                  onChange={() => escolherAno(a)}
                  className="sr-only"
                />
                <span className="font-display text-2xl font-extrabold text-grafite">{a}º</span>
                <span className="text-xs text-pedra">{pronto ? "ano" : "em breve"}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-2 min-h-5 text-sm text-pedra" aria-live="polite">
          {escolhido
            ? `Atividades de ${escolhido.disciplinas.join(", ")}.`
            : TODOS_ANOS.some((a) => !disponiveis.has(a))
              ? "Anos com “em breve” ainda não têm atividades."
              : "Escolha o ano para ver as matérias com atividades."}
        </p>
      </fieldset>

      <div>
        <label htmlFor="nome-turma" className="text-sm font-semibold text-grafite">
          Nome da turma
        </label>
        <input
          id="nome-turma"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setNomeTocado(true);
          }}
          placeholder="Ex.: 6º ano A"
          maxLength={40}
          required
          className="mt-1.5 h-11 w-full rounded-lg border border-input bg-superficie px-3 text-lg text-grafite outline-none placeholder:text-pedra/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="alunos" className="text-sm font-semibold text-grafite">
            Alunos <span className="font-normal text-pedra">(opcional)</span>
          </label>
          <span className="text-sm text-pedra tabular-nums">
            {listaAlunos.length} {listaAlunos.length === 1 ? "aluno" : "alunos"}
          </span>
        </div>
        <textarea
          id="alunos"
          value={alunos}
          onChange={(e) => setAlunos(e.target.value)}
          rows={7}
          placeholder={"Um nome por linha, por exemplo:\nAna Clara Souza\nBruno Ferreira"}
          aria-describedby="alunos-dica"
          className="mt-1.5 w-full rounded-lg border border-input bg-superficie px-3 py-2.5 text-grafite outline-none placeholder:text-pedra/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p id="alunos-dica" className="mt-1.5 text-sm text-pedra">
          Cada aluno recebe um PIN automaticamente. Dá para adicionar mais alunos depois, na página da turma.
        </p>
      </div>

      {erro && (
        <p role="alert" className="rounded-md bg-alerta-clara px-3 py-2 text-sm font-semibold text-alerta">
          {erro}
        </p>
      )}

      <Button type="submit" disabled={!ano || !nome.trim() || enviando || listaAlunos.length > 60} className="h-11 px-6 text-base">
        {enviando ? "Criando…" : "Criar turma"}
      </Button>
    </form>
  );
}
