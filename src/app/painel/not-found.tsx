import { SearchX } from "lucide-react";
import { LinkVoltar } from "@/components/voltar";

export default function NaoEncontradaNoPainel() {
  return (
    <div className="mx-auto max-w-3xl">
      <LinkVoltar href="/painel">Painel</LinkVoltar>
      <div className="mt-6 rounded-lg border bg-superficie p-8 text-center">
        <SearchX className="mx-auto size-10 text-pedra" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold text-grafite">Não encontramos esta página</h1>
        <p className="mx-auto mt-2 max-w-md text-pedra">
          O que você procurava pode ter sido removido, ou o endereço está incompleto. Volte para o painel e escolha de novo.
        </p>
      </div>
    </div>
  );
}
