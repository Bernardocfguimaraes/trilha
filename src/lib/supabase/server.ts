import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Papel } from "@/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && key);

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(url!, key!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component; o proxy renova a sessão.
        }
      },
    },
  });
}

export interface Usuario {
  nome: string;
  email: string;
  papel: Papel;
  token: string | null;
}

// Sem Supabase configurado, o painel abre num modo de demonstração como professor.
export async function getUsuario(): Promise<Usuario | null> {
  if (!supabaseConfigurado) {
    return { nome: "Profa. Marina", email: "demo@trilha.app", papel: "professor", token: null };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: sessao } = await supabase.auth.getSession();
  const meta = data.user.user_metadata ?? {};
  return {
    nome: meta.nome ?? data.user.email ?? "",
    email: data.user.email ?? "",
    papel: meta.papel === "responsavel" ? "responsavel" : "professor",
    token: sessao.session?.access_token ?? null,
  };
}
