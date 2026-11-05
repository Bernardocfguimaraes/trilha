import { Suspense } from "react";
import type { Metadata } from "next";
import { FormAuth } from "@/components/form-auth";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <>
      <h1 className="text-3xl font-bold text-grafite">Entrar no painel</h1>
      <p className="mt-2 mb-8 text-pedra">Para professores. Responsáveis e alunos entram com o código da turma.</p>
      {/* O aviso de "sessão terminou" depende da URL: só essa parte espera a requisição. */}
      <Suspense fallback={<FormAuth />}>
        <Formulario searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Formulario({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const { expirou } = await searchParams;
  return <FormAuth expirou={expirou === "1"} />;
}
