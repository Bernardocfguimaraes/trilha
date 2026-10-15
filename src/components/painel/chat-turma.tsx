"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { MensagemChat, Turma } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGESTOES = [
  "Onde a turma está com mais dificuldade essa semana?",
  "Me dá uma atividade de reforço de fração pra amanhã",
  "Quem precisa de mais atenção?",
  "Quem evoluiu neste bimestre?",
];

// O histórico vive na sessão do navegador: some ao fechar a aba.
const chave = (turmaId: string) => `trilha:chat:${turmaId}`;

function lerHistorico(turmaId: string): MensagemChat[] {
  try {
    return JSON.parse(sessionStorage.getItem(chave(turmaId)) ?? "[]");
  } catch {
    return [];
  }
}

function gravarHistorico(turmaId: string, mensagens: MensagemChat[]) {
  try {
    sessionStorage.setItem(chave(turmaId), JSON.stringify(mensagens));
  } catch {
    // sem sessionStorage (aba privada, bloqueio): a conversa só não sobrevive à navegação
  }
}

const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatTurma({ turma, token }: { turma: Turma; token: string | null }) {
  const [mensagens, setMensagens] = useState<MensagemChat[] | null>(null);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  // sessionStorage só existe no navegador: carrega depois de montar
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única de armazenamento externo
    setMensagens(lerHistorico(turma.id));
  }, [turma.id]);

  useEffect(() => {
    if (mensagens) gravarHistorico(turma.id, mensagens);
    fim.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [mensagens, pensando, turma.id]);

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim();
    if (!limpa || pensando || !mensagens) return;
    const minha: MensagemChat = {
      id: crypto.randomUUID(),
      autor: "professor",
      texto: limpa,
      enviadaEm: new Date().toISOString(),
    };
    const historico = mensagens;
    setMensagens([...historico, minha]);
    setTexto("");
    setFalhou(false);
    setPensando(true);
    try {
      const resposta = await api.chatTurma(turma.id, limpa, historico, token);
      setMensagens((ms) => [...(ms ?? []), resposta]);
    } catch {
      setMensagens(historico);
      setTexto(limpa);
      setFalhou(true);
    } finally {
      setPensando(false);
    }
  }

  function limpar() {
    setMensagens([]);
    setFalhou(false);
  }

  const vazio = mensagens?.length === 0 && !pensando;

  return (
    <section
      aria-label={`Conversa sobre a turma ${turma.nome}`}
      className="flex h-[calc(100dvh-13rem)] min-h-[28rem] flex-col rounded-lg border bg-white"
    >
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <p className="text-sm text-pedra">
          Turma <span className="font-semibold whitespace-nowrap text-grafite">{turma.nome}</span>
          {!process.env.NEXT_PUBLIC_API_URL && (
            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold text-pedra">
              Demonstração
            </span>
          )}
        </p>
        <Button
          variant="ghost"
          onClick={limpar}
          disabled={!mensagens?.length || pensando}
          className="h-8 px-2 text-pedra"
        >
          <Trash2 />
          Limpar conversa
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
        {vazio && (
          <div className="mx-auto flex max-w-lg flex-col items-center pt-6 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-mata-clara text-mata">
              <Sparkles className="size-5" />
            </span>
            <p className="mt-3 font-semibold text-grafite">Pergunte sobre o padrão geral da turma</p>
            <p className="mt-1 text-sm text-pedra">
              As respostas usam o desempenho de todos os alunos nas habilidades ativas. Para um aluno específico,
              abra a página dele.
            </p>
            <ul className="mt-5 flex w-full flex-col gap-2">
              {SUGESTOES.map((s) => (
                <li key={s}>
                  <button
                    onClick={() => enviar(s)}
                    className="w-full rounded-md border px-4 py-2.5 text-left text-sm text-grafite outline-none hover:border-mata hover:bg-mata-clara/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="space-y-5">
          {mensagens?.map((m) =>
            m.autor === "professor" ? (
              <li key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg rounded-br-sm bg-mata-clara px-4 py-2.5 text-grafite">
                  <p className="whitespace-pre-line">{m.texto}</p>
                  <time dateTime={m.enviadaEm} className="mt-1 block text-right text-xs text-pedra">
                    {hora.format(new Date(m.enviadaEm))}
                  </time>
                </div>
              </li>
            ) : (
              <li key={m.id} className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-mata text-white" aria-hidden>
                  <Sparkles className="size-3.5" />
                </span>
                <div className="max-w-[85%] min-w-0">
                  <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-grafite">{m.texto}</p>
                  <time dateTime={m.enviadaEm} className="mt-1 block text-xs text-pedra">
                    {hora.format(new Date(m.enviadaEm))}
                  </time>
                </div>
              </li>
            ),
          )}
          {pensando && (
            <li className="flex items-center gap-3 text-sm text-pedra">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-mata text-white" aria-hidden>
                <Sparkles className="size-3.5" />
              </span>
              <span className="flex items-center gap-1" role="status">
                Analisando a turma
                <span className="flex gap-0.5" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1 animate-pulse rounded-full bg-pedra"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
              </span>
            </li>
          )}
          {falhou && (
            <li role="alert" className="text-sm font-semibold text-alerta">
              Não foi possível responder agora. Sua pergunta voltou para a caixa de texto; envie de novo.
            </li>
          )}
        </ol>
        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="flex items-end gap-2 border-t p-3"
      >
        <label htmlFor="pergunta-turma" className="sr-only">
          Pergunta sobre a turma
        </label>
        <textarea
          id="pergunta-turma"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar(texto);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Ex.: quais habilidades devo retomar antes da prova?"
          className={cn(
            "max-h-32 min-h-10 flex-1 resize-none [field-sizing:content] rounded-md border border-input bg-white px-3 py-2 text-base text-grafite outline-none",
            "placeholder:text-pedra/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        />
        <Button type="submit" disabled={!texto.trim() || pensando || !mensagens} className="size-10" aria-label="Enviar">
          <ArrowUp className="size-5" />
        </Button>
      </form>
    </section>
  );
}
