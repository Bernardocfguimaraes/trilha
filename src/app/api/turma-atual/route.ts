import { NextResponse, type NextRequest } from "next/server";
import { api } from "@/lib/api";
import { COOKIE_PROFESSOR, COOKIE_TURMA, opcoesCookie } from "@/lib/auth";

// Troca a turma que o professor está vendo. Aceita formulário (funciona sem JavaScript:
// volta para o painel) ou JSON. Só aceita turmas desse professor.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_PROFESSOR)?.value;
  if (!token) return new NextResponse("Entre como professor para continuar.", { status: 401 });

  const json = request.headers.get("content-type")?.includes("application/json");
  const dados = json ? await request.json().catch(() => ({})) : Object.fromEntries(await request.formData());
  const id = typeof dados.id === "string" ? dados.id : "";
  const destino = typeof dados.destino === "string" && dados.destino.startsWith("/painel") ? dados.destino : "/painel";

  const turmas = await api.turmas(token).catch(() => []);
  if (!turmas.some((t) => t.id === id)) return new NextResponse("Turma não encontrada", { status: 404 });

  const url = request.nextUrl.clone();
  url.pathname = destino;
  url.search = "";
  const resposta = json ? NextResponse.json({ ok: true }) : NextResponse.redirect(url, 303);
  resposta.cookies.set(COOKIE_TURMA, id, opcoesCookie(request.nextUrl.protocol === "https:", 60 * 60 * 24 * 180));
  return resposta;
}
