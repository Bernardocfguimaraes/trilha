import Link from "next/link";
import { Logo } from "@/components/marca";
import { BotaoTema } from "@/components/tema";

// Área do responsável: visual sóbrio do lado dos adultos, sem navegação do painel.
export default function ResponsavelLayout({ children }: LayoutProps<"/responsavel">) {
  return (
    <div className="flex flex-1 flex-col bg-papel px-4 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-md text-grafite outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <BotaoTema />
      </div>
      {children}
    </div>
  );
}
