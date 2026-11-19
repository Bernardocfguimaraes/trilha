"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Nivel, PerguntaProfessora } from "@/lib/types";
import { Alternativas, NIVEL_ROTULO, Segmentado, Selo, SeloOrigem, TIPO_ROTULO } from "./pecas";

export function SeletorPerguntas({
  turmaId,
  habilidades,
  fonte,
  jaNaTrilha,
  onAdicionar,
}: {
  turmaId: string;
  habilidades: string[];
  fonte: "banco" | "turma";
  jaNaTrilha: Set<string>;
  onAdicionar: (p: PerguntaProfessora) => void;
}) {
  const [perguntas, setPerguntas] = useState<PerguntaProfessora[] | null>(null);
  const [erro, setErro] = useState(false);
  const [nivel, setNivel] = useState<Nivel | "todos">("todos");
  const chave = habilidades.join(",");

  useEffect(() => {
    let vivo = true;
    const lista = chave ? chave.split(",") : [];
    const carregar = fonte === "banco" ? api.bancoDe(turmaId, lista) : api.perguntasDaTurma(turmaId, lista);
    carregar
      .then((r) => vivo && (setPerguntas(r), setErro(false)))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [turmaId, chave, fonte]);

  if (!habilidades.length) return <p className="text-sm text-pedra">Escolha pelo menos um conteúdo no passo 1 para ver as perguntas.</p>;
  if (erro) return <p role="alert" className="text-sm font-semibold text-alerta">Não foi possível carregar as perguntas agora.</p>;
  if (!perguntas) return <p className="text-sm text-pedra" aria-busy="true">Carregando perguntas…</p>;

  const visiveis = perguntas.filter((p) => !jaNaTrilha.has(p.id) && (nivel === "todos" || p.nivel === nivel));
  return (
    <div className="space-y-4">
      <Segmentado
        rotulo="Nível"
        nome={`nivel-${fonte}`}
        valor={nivel}
        onMudar={setNivel}
        opcoes={[
          { valor: "todos", texto: "Todos" },
          { valor: "facil", texto: "Fácil" },
          { valor: "medio", texto: "Médio" },
          { valor: "dificil", texto: "Difícil" },
        ]}
      />
      {visiveis.length === 0 ? (
        <p className="text-sm text-pedra">
          {fonte === "turma"
            ? "Nenhuma pergunta sua salva nestes conteúdos ainda. As que você escrever ou aceitar da IA ficam guardadas aqui para reusar."
            : "Todas as perguntas do banco destes conteúdos já estão na trilha."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((p) => (
            <li key={p.id} className="rounded-lg border bg-superficie p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Selo tom="neutro">{TIPO_ROTULO[p.tipo]}</Selo>
                <Selo tom="neutro">{NIVEL_ROTULO[p.nivel]}</Selo>
                <SeloOrigem origem={p.origem} revisao={p.revisao} />
                <span className="text-xs text-pedra">{p.habilidade.nome}</span>
              </div>
              <p className="mt-2 font-semibold text-grafite">{p.enunciado}</p>
              <Alternativas opcoes={p.opcoes} certa={p.certa} />
              <Button size="sm" variant="outline" className="mt-3" onClick={() => onAdicionar(p)}>
                <Plus />
                Adicionar à trilha
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
