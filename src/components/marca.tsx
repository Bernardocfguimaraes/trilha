import { cn } from "@/lib/utils";
import type { Status } from "@/lib/types";

/** Ícone: um caminho sinuoso tracejado que chega a um marco. */
export function LogoIcone({ className, vibrante = false }: { className?: string; vibrante?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="9" fill={vibrante ? "var(--color-broto)" : "var(--color-mata)"} />
      <path
        d="M7 25c4 0 5-4 9-4s6-4 3-7-1-6 4-6"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="0.1 4.6"
      />
      <rect x="21.5" y="5" width="4" height="7" rx="1.4" fill="var(--color-sol)" />
    </svg>
  );
}

export function Logo({ className, vibrante = false }: { className?: string; vibrante?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoIcone vibrante={vibrante} />
      <span className="font-display text-2xl leading-none font-bold tracking-tight">trilha</span>
    </span>
  );
}

const STATUS_INFO: Record<Status, { rotulo: string; cor: string; fundo: string; marcas: number }> = {
  ok: { rotulo: "Ok", cor: "bg-mata", fundo: "bg-mata-clara text-mata-escura", marcas: 1 },
  atencao: { rotulo: "Atenção", cor: "bg-atencao", fundo: "bg-atencao-clara text-[#7a4f12]", marcas: 2 },
  alerta: { rotulo: "Alerta", cor: "bg-alerta", fundo: "bg-alerta-clara text-alerta", marcas: 3 },
};

export const rotuloStatus = (s: Status) => STATUS_INFO[s].rotulo;

/**
 * Marcas de trilha: como a sinalização pintada em árvores, mais marcas pedem
 * mais atenção. A quantidade carrega o significado junto com a cor.
 */
export function Marcas({ status, className }: { status: Status; className?: string }) {
  const info = STATUS_INFO[status];
  return (
    <span className={cn("inline-flex items-end gap-[3px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "block w-[5px] rounded-[1.5px]",
            i < info.marcas ? info.cor : "bg-border",
          )}
          style={{ height: 8 + i * 3 }}
        />
      ))}
    </span>
  );
}

export function StatusSelo({ status, className }: { status: Status; className?: string }) {
  const info = STATUS_INFO[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold",
        info.fundo,
        className,
      )}
    >
      <Marcas status={status} />
      {info.rotulo}
    </span>
  );
}

type Humor = "feliz" | "pensando" | "festa" | "triste";

/** Sabiá, o mascote. Desenhado com formas simples para escalar bem. */
export function Sabia({ humor = "feliz", className }: { humor?: Humor; className?: string }) {
  const asaCima = humor === "festa";
  return (
    <svg viewBox="0 0 120 120" className={cn("size-24", className)} role="img" aria-label="Sabiá, o mascote da Trilha">
      {/* pés */}
      <path d="M50 104v8M70 104v8" stroke="#c98a2a" strokeWidth="4" strokeLinecap="round" />
      {/* cauda */}
      <path d="M94 74l20 10-18 6z" fill="#7d6149" />
      {/* corpo */}
      <ellipse cx="60" cy="68" rx="40" ry="38" fill="#9b7b5c" />
      {/* barriga laranja */}
      <ellipse cx="56" cy="82" rx="26" ry="22" fill="#f28c3a" />
      {/* asa */}
      {asaCima ? (
        <path d="M88 58c14-18 22-22 26-20-2 10-10 22-24 28z" fill="#7d6149" />
      ) : (
        <ellipse cx="86" cy="72" rx="12" ry="18" fill="#7d6149" transform="rotate(-18 86 72)" />
      )}
      {asaCima && <path d="M30 58C16 40 8 36 4 38c2 10 10 22 24 28z" fill="#7d6149" />}
      {/* olhos */}
      <circle cx="46" cy="54" r="10" fill="#fff" />
      <circle cx="72" cy="54" r="10" fill="#fff" />
      {humor === "festa" ? (
        <>
          <path d="M40 55q6-7 12 0" stroke="#1e2a25" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M66 55q6-7 12 0" stroke="#1e2a25" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={humor === "pensando" ? 49 : 47} cy={humor === "pensando" ? 51 : 55} r="5" fill="#1e2a25" />
          <circle cx={humor === "pensando" ? 75 : 73} cy={humor === "pensando" ? 51 : 55} r="5" fill="#1e2a25" />
          <circle cx={humor === "pensando" ? 50.5 : 48.5} cy={humor === "pensando" ? 49.5 : 53.5} r="1.6" fill="#fff" />
          <circle cx={humor === "pensando" ? 76.5 : 74.5} cy={humor === "pensando" ? 49.5 : 53.5} r="1.6" fill="#fff" />
        </>
      )}
      {humor === "triste" && (
        <path d="M38 42l14 4M80 42l-14 4" stroke="#5a4532" strokeWidth="3" strokeLinecap="round" />
      )}
      {/* bico */}
      <path d="M53 64l7 9 7-9z" fill="var(--color-sol)" stroke="#e0a01a" strokeWidth="1.5" strokeLinejoin="round" />
      {/* bochechas */}
      <circle cx="36" cy="68" r="5" fill="#ff9d7a" opacity=".7" />
      <circle cx="82" cy="68" r="5" fill="#ff9d7a" opacity=".7" />
    </svg>
  );
}
