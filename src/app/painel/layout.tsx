import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/marca";
import { BotaoSair, LinkInicio, NavPainel } from "@/components/painel/nav";
import { BotaoTema } from "@/components/tema";
import { getProfessor } from "@/lib/auth";

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <div className="flex flex-1 flex-col bg-papel md:flex-row">
      <aside className="flex flex-col gap-4 border-b bg-superficie px-4 py-3 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:gap-8 md:border-r md:border-b-0 md:px-3 md:py-5">
        <Suspense
          fallback={
            <div className="md:px-3">
              <Logo className="text-grafite" />
            </div>
          }
        >
          <Lateral />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-10">{children}</main>
    </div>
  );
}

async function Lateral() {
  const usuario = await getProfessor();

  return (
    <>
      <div className="flex items-center justify-between md:px-3">
        <Link href="/painel" className="rounded-md text-grafite outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <div className="flex items-center md:hidden">
          <BotaoTema />
          <LinkInicio />
          <BotaoSair />
        </div>
      </div>
      <NavPainel />
      <div className="mt-auto hidden border-t pt-4 md:block">
        <div className="flex items-center justify-between gap-2 pr-1">
          <p className="truncate px-3 text-sm font-semibold text-grafite">{usuario.nome}</p>
          <BotaoTema />
        </div>
        <p className="truncate px-3 text-sm text-pedra">{usuario.email}</p>
        <div className="mt-2">
          <LinkInicio />
          <BotaoSair />
        </div>
      </div>
    </>
  );
}
