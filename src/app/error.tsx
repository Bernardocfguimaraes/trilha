"use client";

import Link from "next/link";
import { Sabia } from "@/components/marca";
import { classesBotaoGrande } from "@/components/aluno/botao-grande";

export default function Erro({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-ceu px-4 py-12 text-center">
      <title>Algo deu errado | Trilha</title>
      <Sabia humor="pensando" className="size-32" />
      <h1 className="mt-4 font-display text-4xl leading-tight font-extrabold text-grafite">Algo deu errado</h1>
      <p className="mt-3 max-w-md font-display text-xl text-pedra">
        Não conseguimos carregar esta tela agora. Tente de novo em alguns segundos.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={() => retry()} className={classesBotaoGrande("broto")}>
          Tentar de novo
        </button>
        <Link href="/" className={classesBotaoGrande("branco")}>
          Início
        </Link>
      </div>
    </main>
  );
}
