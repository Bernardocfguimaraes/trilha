import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extrairLacuna, fraseCompleta } from "../src/lib/lacuna.ts";

const PASTA = new URL("../backend/app/bncc/perguntas/", import.meta.url);
const embaralhar = (id, opcoes) => {
  const giro = [...id].reduce((soma, c) => soma + c.codePointAt(0), 0) % opcoes.length;
  return { opcoes: [...opcoes.slice(giro), ...opcoes.slice(0, giro)], certa: (opcoes.length - giro) % opcoes.length };
};
const curadas = Object.values(JSON.parse(readFileSync(new URL("../backend/app/bncc/curadas.json", import.meta.url), "utf8")))
  .flat()
  .map(([id, , enunciado, opcoes, extra]) => ({ id, enunciado, ...(extra.certa == null ? embaralhar(id, opcoes) : { opcoes, certa: extra.certa }) }));
const geradas = readdirSync(PASTA)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, PASTA), "utf8")).perguntas);
const banco = [...curadas, ...geradas];
const comoCliente = (p) => ({ enunciado: p.enunciado, opcoes: p.opcoes.map((texto, i) => ({ id: `${p.id}-${i}`, texto })) });

test("lacuna: frase com um buraco e frase com dois", () => {
  const l = extrairLacuna(comoCliente({ id: "x", enunciado: 'Complete: "Os meninos ___ bola."', opcoes: ["jogam", "joga"] }));
  assert.ok(l);
  assert.equal(l.instrucao, "Complete a frase.");
  assert.equal(fraseCompleta(l, { id: "x-0", texto: "jogam" }), "Os meninos jogam bola.");
  const d = extrairLacuna(comoCliente({ id: "y", enunciado: 'Complete: "As ___ estavam ___."', opcoes: ["flores / bonitas", "flor / bonita"] }));
  assert.equal(d.trechos.length, 3);
  assert.deepEqual(d.partes["y-0"], ["flores", "bonitas"]);
});

test("lacuna: número de partes diferente do de buracos cai na múltipla escolha", () => {
  assert.equal(extrairLacuna(comoCliente({ id: "z", enunciado: 'Complete: "Os ___ estavam ___."', opcoes: ["flores", "bonitas"] })), null);
  assert.equal(extrairLacuna(comoCliente({ id: "w", enunciado: "Quanto é 2 + 2?", opcoes: ["4", "5"] })), null);
});

test("banco inteiro: lacunas reconstroem a frase sem perder texto", () => {
  let lacunas = 0;
  for (const p of banco) {
    const q = comoCliente(p);
    const l = extrairLacuna(q);
    if (!l) continue;
    lacunas++;
    const frase = fraseCompleta(l, q.opcoes[p.certa]);
    assert.ok(!/_{2,}/.test(frase), `${p.id}: sobrou buraco em "${frase}"`);
    assert.ok(l.instrucao.length > 3, `${p.id}: instrução vazia`);
  }
  assert.ok(lacunas >= 40, `só ${lacunas} lacunas`);
});

test("questões curadas entram no banco testado, com a resposta certa preservada", () => {
  assert.ok(curadas.length >= 70, `só ${curadas.length} curadas`);
  const p3 = curadas.find((p) => p.id === "p3");
  assert.equal(p3.opcoes[p3.certa], "12");
  const mu1 = curadas.find((p) => p.id === "mu1");
  assert.equal(mu1.opcoes[mu1.certa], "8");
  for (const p of curadas) assert.ok(p.certa >= 0 && p.certa < p.opcoes.length, p.id);
});
