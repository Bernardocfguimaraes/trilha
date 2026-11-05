import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_RESPONSAVEL } from "@/lib/responsavel";

// Mesmo nome do cookie de src/lib/auth.ts (que é server-only e não entra no proxy).
const COOKIE_PROFESSOR = "trilha_sessao";

function redirecionar(request: NextRequest, pathname: string, busca = "") {
  const destino = request.nextUrl.clone();
  destino.pathname = pathname;
  destino.search = busca;
  return NextResponse.redirect(destino);
}

// Primeira barreira, antes de qualquer página renderizar. A conferência de verdade
// (assinatura e validade do token, dono da credencial) acontece no backend.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const professor = request.cookies.has(COOKIE_PROFESSOR);
  const responsavel = request.cookies.has(COOKIE_RESPONSAVEL);

  if (pathname.startsWith("/painel") && !professor) {
    // Quem entrou como responsável neste navegador volta para a área dele.
    return responsavel ? redirecionar(request, "/responsavel/progresso") : redirecionar(request, "/entrar");
  }
  if (pathname.startsWith("/responsavel/progresso") && !responsavel) return redirecionar(request, "/responsavel");
  if (pathname === "/entrar" && professor && !request.nextUrl.searchParams.has("expirou")) {
    return redirecionar(request, "/painel");
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/responsavel/progresso", "/entrar"],
};
