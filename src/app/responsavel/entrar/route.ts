import { NextResponse, type NextRequest } from "next/server";

// Normaliza o código digitado e leva para a escolha do filho.
export function GET(request: NextRequest) {
  const codigo = (request.nextUrl.searchParams.get("codigo") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const destino = request.nextUrl.clone();
  destino.search = "";
  destino.pathname = codigo ? `/responsavel/${encodeURIComponent(codigo)}` : "/responsavel";
  return NextResponse.redirect(destino);
}
