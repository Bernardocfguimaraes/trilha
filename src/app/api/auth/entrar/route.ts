import { NextResponse, type NextRequest } from "next/server";
import { api, ApiError } from "@/lib/api";
import { COOKIE_PROFESSOR, opcoesCookie } from "@/lib/auth";

// Login do professor: o backend confere a senha e devolve o token, que vai direto para um
// cookie httpOnly. O token nunca aparece para o JavaScript da página.
export async function POST(request: NextRequest) {
  const corpo = await request.json().catch(() => null);
  const email = typeof corpo?.email === "string" ? corpo.email.slice(0, 200) : "";
  const senha = typeof corpo?.senha === "string" ? corpo.senha.slice(0, 200) : "";
  if (!email || !senha) return NextResponse.json({ erro: "credenciais" }, { status: 400 });

  try {
    const r = await api.entrar(email, senha);
    const resposta = NextResponse.json({ ok: true, nome: r.nome });
    const segundos = Math.max(60, r.expiraEm - Math.floor(Date.now() / 1000));
    resposta.cookies.set(COOKIE_PROFESSOR, r.token, opcoesCookie(request.nextUrl.protocol === "https:", segundos));
    return resposta;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 422)) {
      return NextResponse.json({ erro: "credenciais" }, { status: 401 });
    }
    if (e instanceof ApiError && e.status === 429) return NextResponse.json({ erro: "bloqueado" }, { status: 429 });
    return NextResponse.json({ erro: "rede" }, { status: 502 });
  }
}
