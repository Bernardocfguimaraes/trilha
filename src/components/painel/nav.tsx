"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, House, LogOut, MessagesSquare, Settings2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavPainel() {
  const pathname = usePathname();
  const itens = [
    {
      href: "/painel",
      rotulo: "Alunos",
      icone: Users,
      ativo: pathname === "/painel" || pathname.startsWith("/painel/alunos"),
    },
    {
      href: "/painel/conversa",
      rotulo: "Conversa",
      icone: MessagesSquare,
      ativo: pathname.startsWith("/painel/conversa"),
    },
    { href: "/painel/turma", rotulo: "Turma", icone: Settings2, ativo: pathname.startsWith("/painel/turma") },
    { href: "/painel/modelo", rotulo: "Diagnóstico", icone: BrainCircuit, ativo: pathname.startsWith("/painel/modelo") },
  ];

  return (
    <nav className="flex gap-1 md:flex-col" aria-label="Painel">
      {itens.map(({ href, rotulo, icone: Icone, ativo }) => (
        <Link
          key={href}
          href={href}
          aria-current={ativo ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            ativo ? "bg-mata-clara text-mata-escura" : "text-pedra hover:bg-secondary hover:text-grafite",
          )}
        >
          <Icone className="size-[18px]" />
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}

/** Volta à página inicial do site (a de escolher "Sou aluno" / "Entrar"). */
export function LinkInicio() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-pedra outline-none hover:bg-secondary hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <House className="size-4" aria-hidden />
      Página inicial
    </Link>
  );
}

/** Sair: formulário POST (um link pré-carregado nunca desloga ninguém sem querer). */
export function BotaoSair() {
  return (
    <form action="/api/auth/sair" method="post">
      <button
        type="submit"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-pedra outline-none hover:bg-secondary hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <LogOut className="size-4" aria-hidden />
        Sair
      </button>
    </form>
  );
}
