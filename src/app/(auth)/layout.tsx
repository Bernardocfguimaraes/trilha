import Link from "next/link";
import { Logo } from "@/components/marca";
import { LinkVoltar } from "@/components/voltar";
import { BotaoTema } from "@/components/tema";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-papel px-4 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-md text-grafite outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <BotaoTema />
      </div>
      <LinkVoltar href="/" className="mt-4 self-start">
        Página inicial
      </LinkVoltar>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      <p className="text-center text-sm text-pedra">
        É aluno?{" "}
        <Link href="/aluno" className="font-semibold text-mata underline-offset-4 hover:underline">
          Entre com o código da turma
        </Link>
        <span className="mx-2" aria-hidden>·</span>
        É responsável?{" "}
        <Link href="/responsavel" className="font-semibold text-mata underline-offset-4 hover:underline">
          Acompanhe seu filho
        </Link>
      </p>
    </div>
  );
}
