import { cn } from "@/lib/utils";
import { Sabia } from "@/components/marca";

export type Marco = "acerto" | "erro" | "pendente";

const W = 360;
const H = 64;

function pontos(n: number) {
  // n marcos + a chegada, em zigue-zague suave
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: 18 + (i * (W - 36)) / n,
    y: H / 2 + (i % 2 === 0 ? 10 : -10),
  }));
}

function caminho(ps: { x: number; y: number }[]) {
  return ps.reduce((d, p, i) => {
    if (i === 0) return `M${p.x} ${p.y}`;
    const a = ps[i - 1];
    const mx = (a.x + p.x) / 2;
    return `${d} C${mx} ${a.y} ${mx} ${p.y} ${p.x} ${p.y}`;
  }, "");
}

/**
 * Progresso como uma trilha: cada pergunta é um marco, e o Sabiá
 * caminha até o marco atual. Acertos viram estrelas.
 */
export function TrilhaProgresso({
  marcos,
  atual,
  comemorando,
  className,
}: {
  marcos: Marco[];
  atual: number;
  comemorando?: boolean;
  className?: string;
}) {
  const ps = pontos(marcos.length);
  const feitos = marcos.filter((m) => m !== "pendente").length;
  const ate = ps.slice(0, Math.min(feitos, marcos.length) + 1);
  const pos = ps[Math.min(atual, marcos.length)];

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ aspectRatio: `${W} / ${H}` }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={marcos.length}
      aria-valuenow={feitos}
      aria-label={`Pergunta ${Math.min(atual + 1, marcos.length)} de ${marcos.length}`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <path d={caminho(ps)} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
        {ate.length > 1 && (
          <path
            d={caminho(ate)}
            fill="none"
            stroke="var(--color-broto)"
            strokeWidth="10"
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        )}
      </svg>

      {marcos.map((m, i) => (
        <span
          key={i}
          className={cn(
            "absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] text-sm sm:size-9",
            m === "acerto" && "border-sol-escuro bg-sol",
            m === "erro" && "border-broto-escuro bg-broto",
            m === "pendente" && "border-ceu-forte bg-white",
          )}
          style={{ left: `${(ps[i].x / W) * 100}%`, top: `${(ps[i].y / H) * 100}%` }}
        >
          {m === "acerto" && <Estrela className="size-4 sm:size-5" />}
          {m === "acerto" && comemorando && i === feitos - 1 && <Brilhos />}
        </span>
      ))}

      {/* chegada */}
      <span
        className="absolute -translate-x-1/2 -translate-y-full font-display text-2xl"
        style={{ left: `${(ps[marcos.length].x / W) * 100}%`, top: `${(ps[marcos.length].y / H) * 100 + 14}%` }}
        aria-hidden
      >
        🏁
      </span>

      {/* Sabiá caminhando */}
      <span
        className="absolute -translate-x-1/2 -translate-y-[95%] transition-[left,top] duration-500 ease-out"
        style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%` }}
        aria-hidden
      >
        <span className={cn("block", comemorando && "animate-pulo")}>
          <Sabia humor={comemorando ? "festa" : "feliz"} className="size-10 sm:size-12" />
        </span>
      </span>
    </div>
  );
}

export function Estrela({ className, apagada }: { className?: string; apagada?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"
        fill={apagada ? "#d5dde0" : "#fff"}
        stroke={apagada ? "#b9c4c8" : "var(--color-sol-escuro)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DIRECOES = [
  [0, -34], [24, -24], [34, 0], [24, 24], [0, 34], [-24, 24], [-34, 0], [-24, -24],
];

function Brilhos() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {DIRECOES.map(([dx, dy], i) => (
        <span
          key={i}
          className="animate-brilho absolute top-1/2 left-1/2 -mt-1 -ml-1 size-2 rounded-full"
          style={
            {
              "--dx": `${dx}px`,
              "--dy": `${dy}px`,
              background: i % 2 ? "var(--color-sol)" : "var(--color-broto)",
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
