"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, MessagesSquare, Settings2, Users } from "lucide-react";
import { createClient, supabaseConfigurado } from "@/lib/supabase/client";
import type { Papel } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NavPainel({ papel }: { papel: Papel }) {
  const pathname = usePathname();
  const itens = [
    {
      href: "/painel",
      rotulo: papel === "professor" ? "Alunos" : "Acompanhamento",
      icone: Users,
      ativo: pathname === "/painel" || pathname.startsWith("/painel/alunos"),
    },
    ...(papel === "professor"
      ? [
          {
            href: "/painel/conversa",
            rotulo: "Conversa",
            icone: MessagesSquare,
            ativo: pathname.startsWith("/painel/conversa"),
          },
          { href: "/painel/turma", rotulo: "Turma", icone: Settings2, ativo: pathname.startsWith("/painel/turma") },
        ]
      : []),
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

export function BotaoSair() {
  const router = useRouter();
  async function sair() {
    if (supabaseConfigurado) await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button
      onClick={sair}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-pedra outline-none hover:bg-secondary hover:text-grafite focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <LogOut className="size-4" />
      Sair
    </button>
  );
}
