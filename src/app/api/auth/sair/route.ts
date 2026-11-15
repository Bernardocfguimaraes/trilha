import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PROFESSOR } from "@/lib/auth";

export function POST(request: NextRequest) {
  const destino = request.nextUrl.clone();
  destino.pathname = "/";
  destino.search = "";
  const resposta = NextResponse.redirect(destino, 303);
  resposta.cookies.delete(COOKIE_PROFESSOR);
  return resposta;
}
