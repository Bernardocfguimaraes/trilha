import type { Metadata } from "next";
import { LinkVoltar } from "@/components/voltar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Acompanhar meu filho" };

const ERROS: Record<string, string> = {
  codigo: "Esse código de turma não existe. Confira as letras e tente de novo.",
  expirou: "Seu acesso expirou. Entre de novo com o código da turma e o PIN.",
};

export default async function ResponsavelPage({ searchParams }: PageProps<"/responsavel">) {
  const { erro } = await searchParams;
  const mensagem = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <>
      <LinkVoltar href="/" className="mt-4 self-start">
        Página inicial
      </LinkVoltar>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <h1 className="text-3xl font-bold text-grafite">Acompanhar meu filho</h1>
        <p className="mt-2 text-pedra">
          Veja como está o seu filho ou a sua filha na trilha. Você vai precisar do código da turma e do PIN de 4
          números da criança — os mesmos que ela usa para entrar.
        </p>

        <form action="/responsavel/entrar" className="mt-8">
          <label htmlFor="codigo" className="block text-sm font-semibold text-grafite">
            Código da turma
          </label>
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
            aria-invalid={erro === "codigo"}
            aria-describedby={mensagem ? "erro-codigo" : undefined}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-white px-3 text-lg font-semibold tracking-[0.15em] text-grafite uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-pedra/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-alerta"
          />
          {mensagem && (
            <p id="erro-codigo" role="alert" className="mt-3 rounded-md bg-alerta-clara px-3 py-2 text-sm font-semibold text-alerta">
              {mensagem}
            </p>
          )}
          <button type="submit" className={cn(buttonVariants({ size: "lg" }), "mt-6 h-11 w-full text-base")}>
            Continuar
          </button>
        </form>
        <p className="mt-6 text-sm text-pedra">
          Você vê só o progresso da sua criança. Não aparecem outros alunos, a turma nem as configurações do professor.
        </p>
      </main>
    </>
  );
}
