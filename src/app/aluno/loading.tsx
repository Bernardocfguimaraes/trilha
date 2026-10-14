import { Sabia } from "@/components/marca";

export default function Carregando() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-ceu px-4" aria-busy="true">
      <span className="animate-pulo block [animation-iteration-count:infinite]">
        <Sabia humor="feliz" className="size-28" />
      </span>
      <p className="font-display text-2xl font-bold text-pedra">Preparando a trilha…</p>
    </main>
  );
}
