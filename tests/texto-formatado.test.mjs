import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarTexto } from "../src/lib/texto-formatado.ts";

const textoDe = (blocos) =>
  blocos
    .flatMap((b) => (b.tipo === "paragrafo" ? b.linhas.flat() : b.itens.flatMap((i) => i.trechos)))
    .map((t) => t.texto)
    .join(" ");

const respostaReal = `**Atividade de reforço – Frações simples (4º B)**

**Objetivo:** Consolidar a identificação de frações equivalentes.

**Procedimento:**

1. **Revisão rápida (5 min)** – Pergunte à turma o que significa “fração equivalente”.

2. **Formação de duplas (2 min)** – Forme duplas misturando os alunos:
- **Bruno F.** + **Ana S.**
- **João D.** + **Enzo M.**

| Aluno | Atividade | Objetivo |
|-------|-----------|----------|
| **Bruno F.** (alerta) | Estação de problemas | Ler e resolver |

### Avaliação rápida
Use *os resultados* para decidir o reforço.`;

test("resposta real da IA: nenhum asterisco, cerquilha ou barra de tabela sobra na tela", () => {
  const visivel = textoDe(formatarTexto(respostaReal));
  assert.ok(!visivel.includes("**"), visivel);
  assert.ok(!/(^|\s)\*\S/.test(visivel), visivel);
  assert.ok(!visivel.includes("###"), visivel);
  assert.ok(!visivel.includes("|"), visivel);
  assert.ok(!visivel.includes("---"), visivel);
});

test("negrito vira trecho em negrito", () => {
  const [p] = formatarTexto("**Objetivo:** consolidar frações.");
  assert.deepEqual(p.linhas[0], [
    { texto: "Objetivo:", negrito: true },
    { texto: " consolidar frações.", negrito: false },
  ]);
});

test("listas numeradas mantêm o número e marcadores viram lista", () => {
  const blocos = formatarTexto(respostaReal);
  const numeradas = blocos.filter((b) => b.tipo === "lista" && b.ordenada).flatMap((b) => b.itens.map((i) => i.numero));
  assert.deepEqual(numeradas, [1, 2]);
  const marcadores = blocos.filter((b) => b.tipo === "lista" && !b.ordenada).flatMap((b) => b.itens);
  assert.ok(marcadores.some((i) => i.trechos.some((t) => t.negrito && t.texto === "Bruno F.")));
});

test("linha de tabela vira item legível, sem a linha separadora", () => {
  const blocos = formatarTexto("| Aluno | Atividade |\n|---|---|\n| Bruno | Jogo |");
  assert.equal(blocos.length, 1);
  assert.deepEqual(blocos[0].itens.map((i) => i.trechos.map((t) => t.texto).join("")), ["Aluno · Atividade", "Bruno · Jogo"]);
});

test("texto comum e contas com asterisco não são alterados", () => {
  assert.equal(textoDe(formatarTexto("Bruno precisa de apoio em frações.")), "Bruno precisa de apoio em frações.");
  assert.equal(textoDe(formatarTexto("Quanto é 2 * 3 * 4?")), "Quanto é 2 * 3 * 4?");
  assert.equal(textoDe(formatarTexto("Use 5*3 e 1/2.")), "Use 5*3 e 1/2.");
});

test("parágrafos separados por linha em branco e linhas mantidas", () => {
  const blocos = formatarTexto("Primeira linha\nsegunda linha\n\nOutro parágrafo");
  assert.equal(blocos.length, 2);
  assert.equal(blocos[0].linhas.length, 2);
});
