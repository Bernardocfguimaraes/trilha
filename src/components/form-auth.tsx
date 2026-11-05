"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROS: Record<string, string> = {
  credenciais: "E-mail ou senha incorretos. Confira e tente de novo.",
  bloqueado: "Muitas tentativas erradas. Espere alguns minutos e tente de novo.",
  rede: "Não foi possível conferir agora. Verifique se a API está ligada e tente de novo.",
};

/** Login do professor. A senha é conferida no backend; o token fica num cookie httpOnly. */
export function FormAuth({ expirou }: { expirou?: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const dados = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: dados.get("email"), senha: dados.get("senha") }),
      });
      if (res.ok) {
        router.replace("/painel");
        router.refresh();
        return;
      }
      const corpo = (await res.json().catch(() => ({}))) as { erro?: string };
      setErro(ERROS[corpo.erro ?? "rede"] ?? ERROS.rede);
    } catch {
      setErro(ERROS.rede);
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {expirou && !erro && (
        <p role="status" className="rounded-md bg-atencao-clara px-3 py-2 text-sm text-atencao-texto">
          Sua sessão terminou. Entre de novo para continuar.
        </p>
      )}

      <Campo id="email" rotulo="E-mail" type="email" autoComplete="email" required maxLength={200} />
      <Campo id="senha" rotulo="Senha" type="password" autoComplete="current-password" required maxLength={200} />

      {erro && (
        <p role="alert" className="rounded-md bg-alerta-clara px-3 py-2 text-sm text-alerta">
          {erro}
        </p>
      )}

      <Button type="submit" disabled={enviando} className="h-11 w-full text-base">
        {enviando ? "Conferindo…" : "Entrar"}
      </Button>

      <p className="text-center text-sm text-pedra">
        A conta do professor é criada pela escola. Esqueceu a senha? Fale com quem administra a Trilha.
      </p>
    </form>
  );
}

function Campo({
  id,
  rotulo,
  dica,
  ...props
}: React.ComponentProps<"input"> & { id: string; rotulo: string; dica?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} name={id} className="h-11 bg-superficie text-base" {...props} />
      {dica && <p className="text-sm text-pedra">{dica}</p>}
    </div>
  );
}
