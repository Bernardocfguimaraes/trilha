import type { Pergunta } from "./types";

/**
 * Pergunta de "tocar no texto": o enunciado traz um trecho entre aspas e todas as opções
 * são palavras desse trecho ("Qual palavra retoma 'Rafael'?"). O aluno responde tocando
 * na palavra dentro do próprio texto, em vez de numa lista separada.
 *
 * Como a lacuna, não muda o contrato com o backend (a resposta segue sendo o id da opção).
 * Se alguma opção não aparecer no texto, ou aparecer mais de uma vez (não daria para saber
 * qual das duas é a tocável), a pergunta segue como múltipla escolha.
 */
export interface Tocar {
  instrucao: string;
  /** O texto em pedaços; os que têm `opcaoId` são as palavras tocáveis. */
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
