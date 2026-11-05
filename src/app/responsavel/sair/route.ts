import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_RESPONSAVEL } from "@/lib/responsavel";

// Sair: apaga a credencial deste navegador. É POST (formulário), para um link
// pré-carregado nunca deslogar ninguém sem querer.
export function POST(request: NextRequest) {
  const destino = request.nextUrl.clone();
  destino.pathname = "/";
  destino.search = "";
  const resposta = NextResponse.redirect(destino, 303);
  resposta.cookies.delete(COOKIE_RESPONSAVEL);
  return resposta;
}
