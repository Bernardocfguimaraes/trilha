"use client";

import { useState } from "react";
import banco from "../../../../backend/app/bncc/perguntas/04-por.json";
import { Quiz } from "@/components/aluno/jornada";
import type { Pergunta, ResultadoResposta } from "@/lib/types";

// Um exemplo de cada tipo: frase com buraco (um e dois buracos), tocar no texto e múltipla escolha,
// para comparar os estilos na mesma trilha.
const IDS = ["ef04lp06-f1", "ef35lp14-f4", "ef04lp07-m2", "ef04lp01-f1", "ef04lp04-d3"];

type DoBanco = (typeof banco.perguntas)[number];

function montar(): { perguntas: Pergunta[]; certas: Record<string, number> } {
  const escolhidas = IDS.map((id) => banco.perguntas.find((p) => p.id === id)).filter(
    (p): p is DoBanco => !!p,
  );
  return {
    perguntas: escolhidas.map((p) => ({
      id: p.id,
      disciplina: "por",
      habilidadeId: p.habilidadeId,
      nivel: p.nivel as Pergunta["nivel"],
      enunciado: p.enunciado,
      apoio: p.apoio ?? undefined,
      opcoes: p.opcoes.map((texto, i) => ({ id: `${p.id}-${i}`, texto })),
    })),
    certas: Object.fromEntries(escolhidas.map((p) => [p.id, p.certa])),
  };
}

export function Previa() {
  const [{ perguntas, certas }] = useState(montar);
  const [rodada, setRodada] = useState(0);
  const [acertos] = useState(() => new Set<string>());

  const cliente = {
    async responder(_sessao: string, perguntaId: string, opcaoId: string): Promise<ResultadoResposta> {
      const p = perguntas.find((q) => q.id === perguntaId)!;
      const certa = p.opcoes[certas[perguntaId]];
      const correta = opcaoId === certa.id;
      if (correta) acertos.add(perguntaId);
      return { correta, opcaoCorretaId: certa.id, mensagem: correta ? "Mandou bem!" : `Quase! A resposta é ${certa.texto}.` };
    },
    async concluirSessao() {
      return { estrelas: acertos.size, total: perguntas.length, mensagem: "Fim da prévia!" };
    },
  };

  return (
    <Quiz
      key={rodada}
      sessaoId="previa"
      perguntas={perguntas}
      cliente={cliente}
      onSair={() => setRodada((r) => r + 1)}
      onFim={() => {
        acertos.clear();
        setRodada((r) => r + 1);
      }}
    />
  );
}
