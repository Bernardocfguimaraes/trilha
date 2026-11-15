import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const codigo = (request.nextUrl.searchParams.get("codigo") ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const destino = request.nextUrl.clone();
  destino.search = "";
  destino.pathname = codigo ? `/aluno/${encodeURIComponent(codigo)}` : "/aluno";
  return NextResponse.redirect(destino);
}
