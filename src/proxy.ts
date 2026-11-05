import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_RESPONSAVEL } from "@/lib/responsavel";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function redirecionar(request: NextRequest, pathname: string) {
  const destino = request.nextUrl.clone();
  destino.pathname = pathname;
  destino.search = "";
  return NextResponse.redirect(destino);
}

// Renova a sessão do Supabase e protege o painel do professor.
export async function proxy(request: NextRequest) {
  const noPainel = request.nextUrl.pathname.startsWith("/painel");

  // Progresso do responsável sem a credencial: volta para a entrada antes de renderizar.
  if (request.nextUrl.pathname.startsWith("/responsavel/progresso") && !request.cookies.has(COOKIE_RESPONSAVEL)) {
    return redirecionar(request, "/responsavel");
  }

  if (!url || !key) {
    // Modo demonstração (sem Supabase): o painel abre como professor para qualquer um.
    // Quem entrou como responsável neste navegador é levado de volta à área dele.
    if (noPainel && request.cookies.has(COOKIE_RESPONSAVEL)) return redirecionar(request, "/responsavel/progresso");
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (noPainel) {
    if (!data.user) return redirecionar(request, "/entrar");
    // Conta de responsável não vê a turma: só o próprio filho, pela área do responsável.
    if (data.user.user_metadata?.papel === "responsavel") return redirecionar(request, "/responsavel");
  }
  return response;
}

export const config = {
  matcher: ["/painel/:path*", "/responsavel/progresso", "/entrar", "/cadastro"],
};
