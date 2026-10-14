import Link from "next/link";
import { Logo, Marcas, Sabia } from "@/components/marca";
import { classesBotaoGrande } from "@/components/aluno/botao-grande";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

const exemplo: { nome: string; status: Status }[] = [
  { nome: "Adição e subtração", status: "ok" },
  { nome: "Multiplicação", status: "atencao" },
  { nome: "Frações simples", status: "alerta" },
];

export default function Home() {
  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Lado do aluno */}
      <section className="relative flex flex-col overflow-hidden bg-ceu px-4 py-6 sm:px-10 sm:py-8">
        <Logo vibrante className="text-grafite" />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
          <Sabia humor="feliz" className="size-36 sm:size-44" />
          <h1 className="max-w-[14ch] font-display text-5xl leading-[0.95] font-extrabold text-grafite sm:text-6xl">
            Bora fazer a trilha de hoje?
          </h1>
          <p className="max-w-[30ch] font-display text-xl font-medium text-pedra">
            Seu professor tem o código da turma. É só digitar e começar.
          </p>
          <Link href="/aluno" className={classesBotaoGrande("broto", "mt-2")}>
            Sou aluno
          </Link>
        </div>
        {/* trilha decorativa ao pé da página */}
        <svg viewBox="0 0 600 80" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full" aria-hidden preserveAspectRatio="none">
          <path d="M-10 70 C120 20 220 80 330 40 S520 10 610 30" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 16" />
        </svg>
      </section>

      {/* Lado do adulto */}
      <section className="flex flex-col justify-center bg-papel px-4 py-14 sm:px-10 lg:px-16">
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold text-grafite sm:text-4xl">
            Veja em que cada aluno precisa de ajuda, e o que fazer a respeito.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-pedra">
            Para responsáveis e professores. A Trilha acompanha as atividades de cada criança,
            aponta as habilidades que pedem atenção e sugere como apoiar em casa ou na sala.
          </p>

          <div className="mt-8 rounded-lg border bg-white p-4" aria-label="Exemplo do painel">
            <p className="text-sm font-semibold text-grafite">Bruno F.</p>
            <ul className="mt-3 space-y-2">
              {exemplo.map((h) => (
                <li key={h.nome} className="flex items-center justify-between text-sm text-pedra">
                  {h.nome}
                  <Marcas status={h.status} />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/entrar" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-base")}>
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-5 text-base")}
            >
              Criar conta
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
