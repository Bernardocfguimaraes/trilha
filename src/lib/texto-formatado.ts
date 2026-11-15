export interface Trecho {
  texto: string;
  negrito: boolean;
}

export type Bloco =
  | { tipo: "paragrafo"; linhas: Trecho[][] }
  | { tipo: "lista"; ordenada: boolean; itens: { numero: number | null; trechos: Trecho[] }[] };

const SEPARADOR_TABELA = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const LINHA_TABELA = /^\s*\|.*\|\s*$/;
const TITULO = /^\s*#{1,6}\s+(.*)$/;
const MARCADOR = /^\s*[-*•]\s+(.*)$/;
const NUMERADO = /^\s*(\d+)[.)]\s+(.*)$/;

function limparInline(texto: string): string {
  return texto
    .replace(/`([^`]+)`/g, "$1")
    .replace(/__(.+?)__/g, "**$1**")
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=$|[\s.,;:!?)])/g, "$1$2");
}

export function trechos(texto: string): Trecho[] {
  const saida: Trecho[] = [];
  const partes = limparInline(texto).split(/\*\*(.+?)\*\*/g);
  partes.forEach((parte, i) => {
    const limpa = parte.replace(/\*\*/g, "");
    if (limpa) saida.push({ texto: limpa, negrito: i % 2 === 1 });
  });
  return saida;
}

export function formatarTexto(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  const estado: { atual: Bloco | null } = { atual: null };

  const fechar = () => {
    if (estado.atual) blocos.push(estado.atual);
    estado.atual = null;
  };
  const item = (ordenada: boolean, numero: number | null, conteudo: string) => {
    let lista = estado.atual;
    if (!lista || lista.tipo !== "lista" || lista.ordenada !== ordenada) {
      fechar();
      lista = { tipo: "lista", ordenada, itens: [] };
      estado.atual = lista;
    }
    lista.itens.push({ numero, trechos: trechos(conteudo) });
  };
  const linhaDeParagrafo = (conteudo: string) => {
    let paragrafo = estado.atual;
    if (!paragrafo || paragrafo.tipo !== "paragrafo") {
      fechar();
      paragrafo = { tipo: "paragrafo", linhas: [] };
      estado.atual = paragrafo;
    }
    paragrafo.linhas.push(trechos(conteudo));
  };

  for (const linha of texto.replace(/\r\n?/g, "\n").split("\n")) {
    if (!linha.trim()) {
      fechar();
      continue;
    }
    if (SEPARADOR_TABELA.test(linha) && linha.includes("-")) continue;
    if (LINHA_TABELA.test(linha)) {
      const celulas = linha.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean);
      item(false, null, celulas.join(" · "));
      continue;
    }
    const titulo = TITULO.exec(linha);
    if (titulo) {
      fechar();
      blocos.push({ tipo: "paragrafo", linhas: [[{ texto: titulo[1].replace(/\*\*/g, "").trim(), negrito: true }]] });
      continue;
    }
    const numerado = NUMERADO.exec(linha);
    if (numerado) {
      item(true, Number(numerado[1]), numerado[2]);
      continue;
    }
    const marcador = MARCADOR.exec(linha);
    if (marcador) {
      item(false, null, marcador[1]);
      continue;
    }
    linhaDeParagrafo(linha.trim());
  }
  fechar();
  return blocos;
}
