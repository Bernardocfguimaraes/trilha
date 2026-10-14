"use client";

import { useState } from "react";
import { dataCurta, dataLonga } from "@/lib/formato";
import type { HistoricoHabilidade } from "@/lib/types";

const W = 280;
const H = 120;
const M = { t: 10, r: 30, b: 22, l: 26 };

/** Linha simples de 0 a 100 para uma habilidade, com tooltip ao passar o cursor. */
export function GraficoEvolucao({ historico }: { historico: HistoricoHabilidade }) {
  const [foco, setFoco] = useState<number | null>(null);
  const ps = historico.pontos;
  const x = (i: number) => M.l + (i * (W - M.l - M.r)) / Math.max(ps.length - 1, 1);
  const y = (v: number) => M.t + ((100 - v) * (H - M.t - M.b)) / 100;
  const linha = ps.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.desempenho)}`).join(" ");
  const ultimo = ps.at(-1);
  const ativo = foco ?? null;

  function mover(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - M.l) / (W - M.l - M.r)) * (ps.length - 1));
    setFoco(Math.max(0, Math.min(ps.length - 1, i)));
  }

  if (!ultimo) return <p className="text-sm text-pedra">Sem atividades registradas.</p>;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={`${historico.nome}: de ${ps[0].desempenho} para ${ultimo.desempenho} pontos`}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={M.l - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-pedra text-[9px]">
              {v}
            </text>
          </g>
        ))}
        <text x={M.l} y={H - 4} className="fill-pedra text-[9px]">
          {dataCurta(ps[0].data)}
        </text>
        <text x={W - M.r} y={H - 4} textAnchor="end" className="fill-pedra text-[9px]">
          {dataCurta(ultimo.data)}
        </text>

        <path d={linha} fill="none" stroke="var(--color-mata)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* rótulo direto só no último ponto */}
        <circle cx={x(ps.length - 1)} cy={y(ultimo.desempenho)} r="4" fill="var(--color-mata)" stroke="#fff" strokeWidth="2" />
        <text x={x(ps.length - 1) + 8} y={y(ultimo.desempenho)} dy="0.32em" className="fill-grafite text-[11px] font-bold">
          {ultimo.desempenho}
        </text>

        {ativo !== null && (
          <g pointerEvents="none">
            <line x1={x(ativo)} x2={x(ativo)} y1={M.t} y2={H - M.b} stroke="var(--color-pedra)" strokeWidth="1" strokeDasharray="2 2" />
            <circle cx={x(ativo)} cy={y(ps[ativo].desempenho)} r="4" fill="var(--color-mata)" stroke="#fff" strokeWidth="2" />
          </g>
        )}
        <rect
          x={M.l}
          y={0}
          width={W - M.l - M.r}
          height={H}
          fill="transparent"
          onPointerMove={mover}
          onPointerLeave={() => setFoco(null)}
        />
      </svg>
      {ativo !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-grafite px-2 py-1 text-xs whitespace-nowrap text-white"
          style={{ left: `${(x(ativo) / W) * 100}%` }}
        >
          Semana de {dataLonga(ps[ativo].data)}: <strong>{ps[ativo].desempenho}</strong>
        </div>
      )}
    </div>
  );
}
