"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient, supabaseConfigurado } from "@/lib/supabase/client";
import type { Papel } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAPEIS: { valor: Papel; rotulo: string; dica: string }[] = [
  { valor: "responsavel", rotulo: "Responsável", dica: "Acompanho meu filho ou minha filha" },
  { valor: "professor", rotulo: "Professor", dica: "Acompanho uma ou mais turmas" },
];

export function FormAuth({ modo }: { modo: "entrar" | "cadastro" }) {
  const router = useRouter();
  const [papel, setPapel] = useState<Papel>("responsavel");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cadastro = modo === "cadastro";

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const dados = new FormData(e.currentTarget);
    const email = String(dados.get("email"));
    const senha = String(dados.get("senha"));

    if (!supabaseConfigurado) {
      router.push("/painel");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { data, error } = cadastro
      ? await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome: String(dados.get("nome")), papel } },
        })
      : await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);

    if (error) {
      setErro(traduzir(error.message));
      return;
    }
    if (cadastro && !data.session) {
      setAviso(`Enviamos um link de confirmação para ${email}. Abra o e-mail para ativar a conta.`);
      return;
    }
    router.push("/painel");
    router.refresh();
  }

  if (aviso) {
    return (
      <div className="rounded-lg border bg-mata-clara p-5 text-mata-escura">
        <p className="font-semibold">Confira seu e-mail</p>
        <p className="mt-1 leading-relaxed">{aviso}</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      {!supabaseConfigurado && (
        <p className="rounded-md bg-atencao-clara px-3 py-2 text-sm text-[#7a4f12]">
          Modo de demonstração: a autenticação ainda não está conectada. Qualquer e-mail e senha abrem o painel.
        </p>
      )}

      {cadastro && (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Você é</legend>
            <div className="grid grid-cols-2 gap-2">
              {PAPEIS.map((p) => (
                <label
                  key={p.valor}
                  className={cn(
                    "cursor-pointer rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    papel === p.valor ? "border-mata bg-mata-clara" : "bg-white hover:bg-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name="papel"
                    value={p.valor}
                    checked={papel === p.valor}
                    onChange={() => setPapel(p.valor)}
                    className="sr-only"
                  />
                  <span className="block font-semibold">{p.rotulo}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-pedra">{p.dica}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Campo id="nome" rotulo="Seu nome" autoComplete="name" required />
        </>
      )}

      <Campo id="email" rotulo="E-mail" type="email" autoComplete="email" required />
      <Campo
        id="senha"
        rotulo="Senha"
        type="password"
        autoComplete={cadastro ? "new-password" : "current-password"}
        minLength={cadastro ? 8 : undefined}
        dica={cadastro ? "Pelo menos 8 caracteres." : undefined}
        required
      />

      {erro && (
        <p role="alert" className="rounded-md bg-alerta-clara px-3 py-2 text-sm text-alerta">
          {erro}
        </p>
      )}

      <Button type="submit" disabled={enviando} className="h-11 w-full text-base">
        {enviando ? "Aguarde…" : cadastro ? "Criar conta" : "Entrar"}
      </Button>

      <p className="text-center text-sm text-pedra">
        {cadastro ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link href={cadastro ? "/entrar" : "/cadastro"} className="font-semibold text-mata underline-offset-4 hover:underline">
          {cadastro ? "Entrar" : "Criar conta"}
        </Link>
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
      <Input id={id} name={id} className="h-11 bg-white text-base" {...props} />
      {dica && <p className="text-sm text-pedra">{dica}</p>}
    </div>
  );
}

function traduzir(msg: string) {
  if (msg.includes("Invalid login")) return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (msg.includes("already registered")) return "Já existe uma conta com este e-mail. Tente entrar.";
  if (msg.includes("Email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  return msg;
}
