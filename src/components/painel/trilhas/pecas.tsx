"use client";

import { ApiError } from "@/lib/api";
import type { Nivel, PerguntaProfessora, RevisaoIa, TipoPergunta } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CAMPO =
  "w-full rounded-lg border border-input bg-superficie px-3 py-2 text-grafite outline-none placeholder:text-pedra/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
export const ROTULO = "text-sm font-semibold text-grafite";

export const NIVEL_ROTULO: Record<Nivel, string> = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
export const TIPO_ROTULO: Record<TipoPergunta, string> = { escolha: "Múltipla escolha", lacuna: "Completar a frase" };
export const LETRAS = ["A", "B", "C", "D"];

export function mensagemDeErro(e: unknown, padrao: string) {
  if (e instanceof ApiError && e.message && !e.message.trim().startsWith("{") && e.status < 500) return e.message;
  if (e instanceof ApiError && e.status === 503 && e.message && !e.message.trim().startsWith("{")) return e.message;
  return padrao;
}

export function Segmentado<T extends string>({
  rotulo,
  opcoes,
  valor,
  onMudar,
  nome,
}: {
  rotulo: string;
  opcoes: { valor: T; texto: string }[];
  valor: T;
  onMudar: (v: T) => void;
  nome: string;
}) {
  return (
    <fieldset>
      <legend className={ROTULO}>{rotulo}</legend>
      <div className="mt-1.5 inline-flex flex-wrap gap-1 rounded-lg bg-secondary p-1">
        {opcoes.map((o) => (
          <label
            key={o.valor}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              valor === o.valor ? "bg-superficie text-mata shadow-sm" : "text-pedra hover:text-grafite",
            )}
          >
            <input type="radio" name={nome} className="sr-only" checked={valor === o.valor} onChange={() => onMudar(o.valor)} />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SeloOrigem({ origem, revisao }: { origem: PerguntaProfessora["origem"]; revisao: RevisaoIa | null }) {
  if (origem === "banco") return <Selo tom="neutro">Do banco</Selo>;
  if (revisao && !revisao.aprovada) return <Selo tom="alerta">{origem === "ia" ? "IA · revisora discordou" : "Sua · revisora discordou"}</Selo>;
  if (origem === "ia") return <Selo tom="ok">{revisao ? "IA · revisada" : "IA · sem revisão"}</Selo>;
  return <Selo tom={revisao ? "ok" : "neutro"}>{revisao ? "Sua · revisada pela IA" : "Sua"}</Selo>;
}

export function Selo({ tom, children }: { tom: "ok" | "alerta" | "neutro"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold",
        tom === "ok" && "bg-mata-clara text-mata-escura",
        tom === "alerta" && "bg-alerta-clara text-alerta",
        tom === "neutro" && "bg-secondary text-pedra",
      )}
    >
      {children}
    </span>
  );
}

export function Alternativas({ opcoes, certa, respostaIa }: { opcoes: string[]; certa: number; respostaIa?: number | null }) {
  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {opcoes.map((o, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-1.5 rounded-md px-2 py-1 text-sm",
            i === certa ? "bg-mata-clara font-semibold text-grafite" : "text-pedra",
          )}
        >
          <span className="shrink-0">{LETRAS[i]})</span>
          <span className="min-w-0 break-words">{o}</span>
          {i === certa && <span className="sr-only">(resposta certa)</span>}
          {respostaIa === i && i !== certa && <span className="ml-auto shrink-0 text-xs font-semibold text-alerta">IA marcou</span>}
        </li>
      ))}
    </ul>
  );
}
