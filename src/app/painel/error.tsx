"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LinkVoltar } from "@/components/voltar";

export default function ErroNoPainel({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <title>Algo deu errado | Trilha</title>
      <LinkVoltar href="/painel">Alunos</LinkVoltar>
      <div role="alert" className="mt-6 rounded-lg border bg-superficie p-8 text-center">
        <TriangleAlert className="mx-auto size-10 text-alerta" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold text-grafite">Não foi possível carregar esta tela</h1>
        <p className="mx-auto mt-2 max-w-md text-pedra">
          A conexão com o servidor falhou ou demorou demais. Seus dados estão salvos; tente de novo.
        </p>
        <Button onClick={() => retry()} className="mt-5">
          <RefreshCw />
          Tentar de novo
        </Button>
      </div>
    </div>
  );
}
