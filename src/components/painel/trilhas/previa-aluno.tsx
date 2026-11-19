"use client";

import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Quiz } from "@/components/aluno/jornada";
import type { Pergunta, PerguntaProfessora, ResultadoResposta, ResultadoSessao } from "@/lib/types";

export function PreviaAluno({ perguntas, disciplina, onFechar }: { perguntas: PerguntaProfessora[]; disciplina: string; onFechar: () => void }) {
  const doAluno = useMemo<Pergunta[]>(
    () =>
      perguntas.map((p) => ({
        id: p.id,
        disciplina,
        habilidadeId: p.habilidade.id,
        nivel: p.nivel,
        enunciado: p.enunciado,
        opcoes: p.opcoes.map((texto, i) => ({ id: `${p.id}-${i}`, texto })),
      })),
    [perguntas, disciplina],
  );

  const cliente = useMemo(() => {
    const acertadas = new Set<string>();
    const respondidas = new Set<string>();
    return {
      responder: async (_sessao: string, perguntaId: string, opcaoId: string): Promise<ResultadoResposta> => {
        const p = perguntas.find((x) => x.id === perguntaId)!;
        const certaId = `${p.id}-${p.certa}`;
        const correta = opcaoId === certaId;
        if (correta && !respondidas.has(perguntaId)) acertadas.add(perguntaId);
        respondidas.add(perguntaId);
        return { correta, opcaoCorretaId: certaId, mensagem: correta ? "Acertou!" : `Quase! A resposta é ${p.opcoes[p.certa]}.` };
      },
      concluirSessao: async (): Promise<ResultadoSessao> => ({ estrelas: acertadas.size, total: perguntas.length, mensagem: "Fim da prévia" }),
    };
  }, [perguntas]);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", fechar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fechar);
      document.body.style.overflow = overflow;
    };
  }, [onFechar]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Prévia da trilha como o aluno vê" className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ceu">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-grafite px-4 py-2 text-sm text-papel">
        <span className="font-semibold">Prévia: é assim que o aluno vê. As respostas daqui não contam.</span>
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/50"
        >
          <X className="size-4" aria-hidden />
          Fechar prévia
        </button>
      </div>
      <Quiz sessaoId="previa" perguntas={doAluno} onSair={onFechar} onFim={onFechar} cliente={cliente} />
    </div>
  );
}
