import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_RESPONSAVEL } from "@/lib/responsavel";

export function POST(request: NextRequest) {
  const destino = request.nextUrl.clone();
  destino.pathname = "/";
  destino.search = "";
  const resposta = NextResponse.redirect(destino, 303);
  resposta.cookies.delete(COOKIE_RESPONSAVEL);
  return resposta;
}
