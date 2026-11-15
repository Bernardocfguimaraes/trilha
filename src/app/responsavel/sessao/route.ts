import { NextResponse, type NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api";
import { COOKIE_RESPONSAVEL, opcoesCookieResponsavel } from "@/lib/responsavel";

export async function POST(request: NextRequest) {
  const corpo = await request.json().catch(() => null);
  const alunoId = corpo?.alunoId;
  const pin = corpo?.pin;
  if (typeof alunoId !== "string" || typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ valido: false, bloqueado: false }, { status: 400 });
  }
  try {
    const r = await api.validarPin(alunoId, pin);
    if (!r.valido || !r.acesso) return NextResponse.json({ valido: false, bloqueado: r.bloqueado });
    const resposta = NextResponse.json({ valido: true, bloqueado: false });
    resposta.cookies.set(COOKIE_RESPONSAVEL, r.acesso, opcoesCookieResponsavel(request.nextUrl.protocol === "https:"));
    return resposta;
  } catch (e) {
    const status = e instanceof ApiError && e.status === 404 ? 404 : 502;
    return NextResponse.json({ valido: false, bloqueado: false }, { status });
  }
}
