import type { Opcao, Pergunta } from "./types";

/**
 * Pergunta de "completar a lacuna": a frase tem um ou mais buracos ("___") e cada opção
 * preenche todos eles (partes separadas por " / ", ex.: "alunos / animados").
 *
 * Não muda o contrato com o backend: a resposta continua sendo o id de uma opção. A forma
 * interativa é reconhecida a partir do enunciado; se algo não bater (número de partes
 * diferente do número de buracos), a pergunta segue como múltipla escolha.
 */
export interface Lacuna {
  instrucao: string;
  /** Trechos da frase entre os buracos: sempre `buracos + 1` itens. */
  trechos: string[];
  /** Partes de cada opção, por id, na ordem dos buracos. */
  partes: Record<string, string[]>;
}

const BURACO = /_{2,}/;

export function extrairLacuna(p: Pick<Pergunta, "enunciado" | "opcoes">): Lacuna | null {
  const e = p.enunciado.trim();
  // A frase com buraco vem entre aspas ("Complete: \"Eu ___ um suco.\"") ou é a última
  // palavra do enunciado ("Qual letra completa a palavra? pa__arinho").
  const aspas = /"([^"]*_{2,}[^"]*)"/.exec(e) ?? /“([^”]*_{2,}[^”]*)”/.exec(e);
  let frase: string;
  let antes: string;
  let depois: string;
  if (aspas) {
    frase = aspas[1];
    antes = e.slice(0, aspas.index).trim();
    depois = e.slice(aspas.index + aspas[0].length).trim();
  } else {
    const ultima = /(\S*_{2,}\S*)$/.exec(e);
    if (!ultima) return null;
    frase = ultima[1];
    antes = e.slice(0, ultima.index).trim();
    depois = "";
  }

  const trechos = frase.split(BURACO);
  const buracos = trechos.length - 1;
  if (buracos < 1) return null;

  const partes: Record<string, string[]> = {};
  for (const o of p.opcoes) {
    const ps = buracos === 1 ? [o.texto.trim()] : o.texto.split(" / ").map((s) => s.trim());
    if (ps.length !== buracos || ps.some((s) => !s)) return null;
    partes[o.id] = ps;
  }

  return { instrucao: instrucao(antes, depois), trechos, partes };
}

function instrucao(antes: string, depois: string): string {
  const semFim = (s: string) => s.replace(/[:\s]+$/, "");
  // "Complete: "…" Qual opção está correta?" vira só "Complete a frase."
  if (/^(complete|leia)\b/i.test(antes) || !antes) {
    const pergunta = depois.replace(/^[?.!\s]+/, "");
    if (pergunta && !/qual opção está correta/i.test(pergunta)) return pergunta;
    return /^complete\b/i.test(antes) && /[a-z]/i.test(antes.slice(8)) ? semFim(antes) : "Complete a frase.";
  }
  const base = semFim(antes);
  return /[?.!]$/.test(base) ? base : `${base.replace(/\s+com$/i, "")}?`;
}

/** A frase com os buracos preenchidos por uma opção (para leitores de tela e para "Ouvir"). */
export function fraseCompleta(l: Lacuna, opcao: Opcao | undefined, vazio = "lacuna"): string {
  const ps = opcao ? l.partes[opcao.id] : undefined;
  return l.trechos.map((t, i) => (i === 0 ? t : `${ps ? ps[i - 1] : vazio}${t}`)).join("");
}
