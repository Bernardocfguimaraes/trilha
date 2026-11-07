import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PROFESSOR } from "@/lib/auth";

// Ponte das telas do painel (componentes do navegador) para as rotas do professor no
// backend: lê o token do cookie httpOnly e o anexa. Só repassa as rotas do painel.
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PERMITIDAS = [
  /^anos$/,
  /^modelo$/,
  /^turmas$/,
  /^turmas\/[\w-]+\/(alunos|cadastros|configuracao|diagnostico|chat|grupos)$/,
  /^alunos\/[\w-]+(\/(historico|pin|diagnostico))?$/,
  /^alunos\/[\w-]+\/diagnostico\/[\w-]+$/,
  /^exercicios\/gerar$/,
  /^voz\/transcrever$/,
];

async function repassar(request: NextRequest, ctx: RouteContext<"/api/professor/[...caminho]">) {
  const { caminho } = await ctx.params;
  const rota = caminho.join("/");
  if (!PERMITIDAS.some((r) => r.test(rota))) return new NextResponse("Não encontrado", { status: 404 });

  const token = request.cookies.get(COOKIE_PROFESSOR)?.value;
  if (!token) return new NextResponse("Entre como professor para continuar.", { status: 401 });

  const multipart = request.headers.get("content-type")?.startsWith("multipart/form-data");
  if (!API_URL) {
    // Sem backend: o mock do front responde (mesmas regras de login).
    if (multipart) return new NextResponse("Transcrição de voz precisa do backend", { status: 503 });
    const { mockRequest } = await import("@/lib/mock");
    const { ApiError } = await import("@/lib/api");
    try {
      const body = request.method === "GET" ? undefined : await request.json().catch(() => undefined);
      return NextResponse.json(await mockRequest("/" + rota, request.method, body, token));
    } catch (e) {
      if (e instanceof ApiError) return new NextResponse(e.message, { status: e.status });
      throw e;
    }
  }

  const resposta = await fetch(`${API_URL}/${rota}`, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(multipart ? { "Content-Type": request.headers.get("content-type")! } : { "Content-Type": "application/json" }),
    },
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers: { "Content-Type": resposta.headers.get("content-type") ?? "application/json" },
  });
}

export { repassar as GET, repassar as POST, repassar as PUT };
