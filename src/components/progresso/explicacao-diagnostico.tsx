import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { rotuloStatus } from "@/components/marca";
import type { DiagnosticoHabilidade, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDEM: Status[] = ["alerta", "atencao", "ok"];
const COR: Record<Status, string> = { alerta: "bg-alerta", atencao: "bg-atencao", ok: "bg-mata" };
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * "Por que está em alerta?": a decisão do modelo de ML, a confiança dele e os indicadores
 * que pesaram. A barra mostra a probabilidade de cada status (voto das 200 árvores); cada
 * parte tem nome e porcentagem escritos, então a cor nunca é a única pista.
 */
export function ExplicacaoDiagnostico({ d }: { d: DiagnosticoHabilidade }) {
  const rotulo = rotuloStatus(d.status).toLowerCase();
  return (
    <details className="group mt-3 border-t pt-2">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 rounded-md py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold text-grafite">Por que {d.status === "ok" ? "está ok" : `está em ${rotulo}`}?</span>
          {d.confianca !== null && <span className="block text-xs text-pedra tabular-nums">{pct(d.confianca)} de confiança do modelo</span>}
        </span>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-pedra transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="pt-2 pb-1">
        {d.probabilidades && (
          <>
            <div className="flex h-2 gap-[2px]" aria-hidden>
              {ORDEM.filter((s) => d.probabilidades![s] >= 0.01).map((s) => (
                <span
                  key={s}
                  title={`${rotuloStatus(s)}: ${pct(d.probabilidades![s])}`}
                  className={cn("h-full rounded-[2px]", COR[s])}
                  style={{ width: `${d.probabilidades![s] * 100}%` }}
                />
              ))}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-pedra" aria-label="Probabilidade de cada status">
              {ORDEM.map((s) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", COR[s])} aria-hidden />
                  {rotuloStatus(s)} <span className="font-semibold text-grafite tabular-nums">{pct(d.probabilidades![s])}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <ul className="mt-3 space-y-1 text-sm leading-snug text-grafite">
          {d.motivos.map((m) => (
            <li key={m} className="flex gap-2">
              <span className="mt-[0.45em] size-1.5 shrink-0 rounded-full bg-pedra/60" aria-hidden />
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-pedra">
          {d.modelo === "ml" ? "Decisão do modelo de diagnóstico (Random Forest). " : "Modelo indisponível: regra simples de média. "}
          <Link href="/painel/modelo" className="font-semibold text-mata underline-offset-4 hover:underline">
            Como o diagnóstico funciona
          </Link>
        </p>
      </div>
    </details>
  );
}
