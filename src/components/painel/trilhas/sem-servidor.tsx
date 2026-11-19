import { ServerOff } from "lucide-react";

export function SemServidor() {
  return (
    <div className="mt-8 rounded-lg border bg-superficie p-6 text-center">
      <ServerOff className="mx-auto size-8 text-pedra" aria-hidden />
      <p className="mt-3 font-semibold text-grafite">As trilhas da semana precisam do servidor da Trilha.</p>
      <p className="mt-1 text-sm text-pedra">No modo demonstração, sem a API, dá para ver o restante do painel, mas não criar trilhas.</p>
    </div>
  );
}
