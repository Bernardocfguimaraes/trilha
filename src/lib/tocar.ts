import type { Pergunta } from "./types";

export interface Tocar {
  instrucao: string;
  pedacos: { texto: string; opcaoId?: string }[];
}

const PALAVRA = /[\p{L}]+(?:[-‑'][\p{L}]+)*/gu;

export function extrairTocar(p: Pick<Pergunta, "enunciado" | "opcoes">): Tocar | null {
  if (p.opcoes.length < 3) return null;
  const m = /"([^"]{8,})"/.exec(p.enunciado) ?? /“([^”]{8,})”/.exec(p.enunciado);
  if (!m || /_{2,}/.test(m[1])) return null;
  const texto = m[1];
  const instrucao = p.enunciado.slice(m.index + m[0].length).trim();
  if (!instrucao) return null;

  const porPalavra = new Map(p.opcoes.map((o) => [o.texto.trim().toLowerCase(), o.id]));
  const achadas = new Map<string, number>();
  const pedacos: Tocar["pedacos"] = [];
  let ultimo = 0;
  for (const w of texto.matchAll(PALAVRA)) {
    const id = porPalavra.get(w[0].toLowerCase());
    if (!id) continue;
    achadas.set(id, (achadas.get(id) ?? 0) + 1);
    if (w.index > ultimo) pedacos.push({ texto: texto.slice(ultimo, w.index) });
    pedacos.push({ texto: w[0], opcaoId: id });
    ultimo = w.index + w[0].length;
  }
  if (ultimo < texto.length) pedacos.push({ texto: texto.slice(ultimo) });

  const valida = p.opcoes.every((o) => achadas.get(o.id) === 1);
  return valida ? { instrucao, pedacos } : null;
}
