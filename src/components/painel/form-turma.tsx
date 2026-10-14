"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { TurmaConfig } from "@/lib/types";

export function FormTurma({ config, token }: { config: TurmaConfig; token: string | null }) {
  const inicial = config.disciplinas.flatMap((d) => d.habilidades.filter((h) => h.ativa).map((h) => h.id));
  const [salvas, setSalvas] = useState(() => new Set(inicial));
  const [ativas, setAtivas] = useState(() => new Set(inicial));
  const [estado, setEstado] = useState<"livre" | "salvando" | "salvo" | "erro">("livre");

  const alterado = ativas.size !== salvas.size || [...ativas].some((id) => !salvas.has(id));

  function alternar(id: string, ligada: boolean) {
    setEstado("livre");
    setAtivas((s) => {
      const n = new Set(s);
      if (ligada) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function salvar() {
    setEstado("salvando");
    try {
      await api.salvarTurmaConfig([...ativas], token);
      setSalvas(new Set(ativas));
      setEstado("salvo");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="space-y-8">
      {config.disciplinas.map((d) => {
        const ligadas = d.habilidades.filter((h) => ativas.has(h.id)).length;
        return (
          <section key={d.id} aria-labelledby={`disc-${d.id}`} className="rounded-lg border bg-white">
            <header className="flex items-baseline justify-between border-b px-5 py-4">
              <h2 id={`disc-${d.id}`} className="text-lg font-bold text-grafite">
                {d.nome}
              </h2>
              <p className="text-sm text-pedra">
                {ligadas} de {d.habilidades.length} ativas
              </p>
            </header>
            <ul className="divide-y">
              {d.habilidades.map((h) => (
                <li key={h.id}>
                  <label className="flex cursor-pointer items-start justify-between gap-6 px-5 py-4 hover:bg-papel">
                    <span>
                      <span className="block font-semibold text-grafite">{h.nome}</span>
                      <span className="mt-0.5 block max-w-prose text-sm leading-relaxed text-pedra">{h.descricao}</span>
                    </span>
                    <Switch
                      checked={ativas.has(h.id)}
                      onCheckedChange={(v) => alternar(h.id, v)}
                      className="mt-1"
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t bg-papel/95 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
        <Button onClick={salvar} disabled={!alterado || estado === "salvando"} className="h-10 px-5 text-base">
          {estado === "salvando" ? "Salvando…" : "Salvar habilidades"}
        </Button>
        <p role="status" className="text-sm">
          {estado === "salvo" && !alterado && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-mata">
              <Check className="size-4" /> Habilidades salvas. As próximas atividades já seguem esta seleção.
            </span>
          )}
          {estado === "erro" && (
            <span className="font-semibold text-alerta">Não foi possível salvar. Verifique a conexão e tente de novo.</span>
          )}
          {estado === "livre" && alterado && <span className="text-pedra">Há alterações não salvas.</span>}
        </p>
      </div>
    </div>
  );
}

export function CodigoTurma({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard.writeText(`${window.location.origin}/aluno/${codigo}`);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-mata p-5 text-white">
      <div>
        <p className="text-sm text-white/80">Código para os alunos entrarem</p>
        <p className="mt-1 font-display text-4xl leading-none font-extrabold tracking-[0.15em]">{codigo}</p>
      </div>
      <Button variant="secondary" onClick={copiar} className="h-10 px-4 text-base">
        {copiado ? <Check /> : <Copy />}
        {copiado ? "Link copiado" : "Copiar link da turma"}
      </Button>
    </div>
  );
}
