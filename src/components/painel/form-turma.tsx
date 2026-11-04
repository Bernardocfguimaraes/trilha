"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import type { HabilidadeConfig, TurmaConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FormTurma({ config, token }: { config: TurmaConfig; token: string | null }) {
  const inicial = config.disciplinas.flatMap((d) => d.habilidades.filter((h) => h.ativa).map((h) => h.id));
  const [salvas, setSalvas] = useState(() => new Set(inicial));
  const [ativas, setAtivas] = useState(() => new Set(inicial));
  const [estado, setEstado] = useState<"livre" | "salvando" | "salvo" | "erro">("livre");
  const disciplinasIniciais = config.disciplinas.filter((d) => d.ativa).map((d) => d.id);
  const [disciplinasSalvas, setDisciplinasSalvas] = useState(() => new Set(disciplinasIniciais));
  const [disciplinas, setDisciplinas] = useState(() => new Set(disciplinasIniciais));

  const difere = (a: Set<string>, b: Set<string>) => a.size !== b.size || [...a].some((id) => !b.has(id));
  const alterado = difere(ativas, salvas) || difere(disciplinas, disciplinasSalvas);

  function alternarDisciplina(id: string, ligada: boolean) {
    setEstado("livre");
    setDisciplinas((s) => {
      const n = new Set(s);
      if (ligada) n.add(id);
      else n.delete(id);
      return n;
    });
  }

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
      await api.salvarTurmaConfig([...ativas], token, [...disciplinas]);
      setSalvas(new Set(ativas));
      setDisciplinasSalvas(new Set(disciplinas));
      setEstado("salvo");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="space-y-8">
      {config.disciplinas.map((d) => {
        const avaliaveis = d.habilidades.filter((h) => h.avaliavel);
        const ligadas = avaliaveis.filter((h) => ativas.has(h.id)).length;
        const emSala = d.habilidades.length - avaliaveis.length;
        const disciplinaLigada = disciplinas.has(d.id);
        const item = (h: HabilidadeConfig) => (
          <ItemHabilidade key={h.id} h={h} ligada={ativas.has(h.id)} onAlternar={(v) => alternar(h.id, v)} />
        );
        return (
          <section key={d.id} aria-labelledby={`disc-${d.id}`} className="rounded-lg border bg-white">
            <header className="flex items-center justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 id={`disc-${d.id}`} className="text-lg font-bold text-grafite">
                  {d.nome}
                  {d.caminhoBncc && (
                    <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 align-middle text-xs font-semibold text-pedra">
                      Caminho BNCC · {config.turma.ano}º ano
                    </span>
                  )}
                </h2>
                <p className="text-sm text-pedra">
                  {disciplinaLigada
                    ? `${ligadas} de ${avaliaveis.length} habilidades ativas` +
                      (emSala > 0 ? ` · ${emSala} trabalhadas em sala (produção e oralidade)` : "")
                    : "Desligada: não aparece para os alunos nem no diagnóstico"}
                </p>
              </div>
              <Switch
                checked={disciplinaLigada}
                onCheckedChange={(v) => alternarDisciplina(d.id, v)}
                aria-label={`${disciplinaLigada ? "Desativar" : "Ativar"} ${d.nome}`}
              />
            </header>
            {d.caminhoBncc ? (
              // Caminho BNCC: unidades na ordem do caminho, recolhíveis (são dezenas de habilidades)
              <div className={cn("divide-y", !disciplinaLigada && "opacity-50")} inert={!disciplinaLigada}>
                {unidades(d.habilidades).map(([unidade, habs]) => {
                  const avaliaveisUnidade = habs.filter((h) => h.avaliavel);
                  return (
                    <details key={unidade} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-semibold text-grafite outline-none hover:bg-papel focus-visible:bg-papel">
                        <span>{unidade}</span>
                        <span className="text-sm font-normal text-pedra">
                          {avaliaveisUnidade.length > 0
                            ? `${avaliaveisUnidade.filter((h) => ativas.has(h.id)).length} de ${avaliaveisUnidade.length} ativas`
                            : "Em sala"}
                        </span>
                      </summary>
                      <ul className="divide-y border-t">{habs.map(item)}</ul>
                    </details>
                  );
                })}
              </div>
            ) : (
              <ul className={cn("divide-y", !disciplinaLigada && "opacity-50")} inert={!disciplinaLigada}>
                {d.habilidades.map(item)}
              </ul>
            )}
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t bg-papel/95 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
        <Button onClick={salvar} disabled={!alterado || estado === "salvando"} className="h-10 px-5 text-base">
          {estado === "salvando" ? "Salvando…" : "Salvar configuração"}
        </Button>
        <p role="status" className="text-sm">
          {estado === "salvo" && !alterado && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-mata">
              <Check className="size-4" /> Configuração salva. As próximas atividades já seguem esta seleção.
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

/** Agrupa por unidade do caminho, mantendo a ordem em que a API envia. */
function unidades(habilidades: HabilidadeConfig[]) {
  const grupos = new Map<string, HabilidadeConfig[]>();
  for (const h of habilidades) {
    const u = h.unidade ?? "Outras";
    grupos.set(u, [...(grupos.get(u) ?? []), h]);
  }
  return [...grupos];
}

function ItemHabilidade({ h, ligada, onAlternar }: { h: HabilidadeConfig; ligada: boolean; onAlternar: (v: boolean) => void }) {
  const texto = (
    <span>
      <span className="block font-semibold text-grafite">
        {h.codigoBncc && <span className="mr-2 font-mono text-xs font-normal text-pedra">{h.codigoBncc}</span>}
        {h.nome}
      </span>
      <span className="mt-0.5 block max-w-prose text-sm leading-relaxed text-pedra">{h.descricao}</span>
    </span>
  );
  if (!h.avaliavel) {
    // Produção, oralidade, apreciação: faz parte do caminho, mas não cabe em quiz
    return (
      <li className="flex items-start justify-between gap-6 px-5 py-4">
        {texto}
        <span className="mt-1 shrink-0 rounded bg-secondary px-2 py-0.5 text-xs font-semibold text-pedra">Em sala</span>
      </li>
    );
  }
  return (
    <li>
      <label className="flex cursor-pointer items-start justify-between gap-6 px-5 py-4 hover:bg-papel">
        {texto}
        <Switch checked={ligada} onCheckedChange={onAlternar} className="mt-1" />
      </label>
    </li>
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
