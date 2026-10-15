import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api";
import { mockRequest } from "@/lib/mock";

// Ponte para o mock (src/lib/mock.ts) quando a chamada parte do navegador.
// Só existe enquanto NEXT_PUBLIC_API_URL não está definida — com o backend real, some.
async function responder(request: NextRequest, ctx: RouteContext<"/api/mock/[...caminho]">) {
  if (process.env.NEXT_PUBLIC_API_URL) return new NextResponse("Not found", { status: 404 });

  const { caminho } = await ctx.params;
  const path = "/" + caminho.map(encodeURIComponent).join("/");
  const body = request.method === "GET" ? undefined : await request.json().catch(() => undefined);
  try {
    return NextResponse.json(await mockRequest(path, request.method, body));
  } catch (e) {
    if (e instanceof ApiError) return new NextResponse(e.message, { status: e.status });
    throw e;
  }
}

export { responder as GET, responder as POST, responder as PUT };
