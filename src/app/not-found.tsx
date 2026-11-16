import type { Metadata } from "next";
import Link from "next/link";
import { Sabia } from "@/components/marca";
import { classesBotaoGrande } from "@/components/aluno/botao-grande";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NaoEncontrada() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-ceu px-4 py-12 text-center">
      <Sabia humor="pensando" className="size-32" />
      <h1 className="mt-4 font-display text-4xl leading-tight font-extrabold text-grafite">Página não encontrada</h1>
      <p className="mt-3 max-w-md font-display text-xl text-pedra">
        O endereço pode ter mudado ou estar com alguma letra trocada.
      </p>
      <Link href="/" className={classesBotaoGrande("broto", "mt-8")}>
        Ir para o início
      </Link>
    </main>
  );
}
