import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Sabia } from "@/components/marca";
import { classesBotaoGrande } from "@/components/aluno/botao-grande";

export const metadata: Metadata = { title: "Entrar na turma" };

export default async function AlunoPage({ searchParams }: PageProps<"/aluno">) {
  const { erro } = await searchParams;
  const codigoInvalido = erro === "codigo";

  return (
    <main className="flex flex-1 flex-col bg-ceu px-4 py-6">
      <Link
        href="/"
        aria-label="Voltar"
        className="grid size-11 place-items-center rounded-full text-pedra outline-none hover:bg-white/70 focus-visible:ring-4 focus-visible:ring-grafite/30"
      >
        <ArrowLeft className="size-7" strokeWidth={3} />
      </Link>

      <form action="/aluno/entrar" className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        <Sabia humor={codigoInvalido ? "triste" : "feliz"} className="size-32" />
        <label htmlFor="codigo" className="mt-4 font-display text-4xl leading-none font-extrabold text-grafite">
          Qual é o código da sua turma?
        </label>
        <p className="mt-3 font-display text-xl text-pedra">Ele está no quadro ou com seu professor.</p>

        <input
          id="codigo"
          name="codigo"
          required
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          placeholder="ABC123"
          aria-invalid={codigoInvalido}
          aria-describedby={codigoInvalido ? "erro-codigo" : undefined}
          className="mt-8 h-20 w-full rounded-2xl border-[3px] border-ceu-forte bg-white text-center font-display text-5xl font-extrabold tracking-[0.2em] text-grafite uppercase shadow-[0_5px_0_var(--color-ceu-forte)] outline-none placeholder:text-[#c5d3d8] focus:border-[#2a8fc4] aria-invalid:border-coral"
        />
        {codigoInvalido && (
          <p id="erro-codigo" role="alert" className="mt-4 rounded-xl bg-coral-claro px-4 py-2 font-display text-xl font-semibold text-grafite">
            Esse código não existe. Confira as letras e tente de novo.
          </p>
        )}

        <button type="submit" className={classesBotaoGrande("broto", "mt-8 w-full")}>
          Entrar
        </button>
      </form>
    </main>
  );
}
