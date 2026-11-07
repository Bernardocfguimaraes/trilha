// Testes do front (node --test): os leitores que transformam uma pergunta em "complete a
// frase" ou "toque na palavra", rodando sobre o banco inteiro de questões do backend.
// O Node 24 executa o TypeScript de src/lib direto (só remove os tipos).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extrairLacuna, fraseCompleta } from "../src/lib/lacuna.ts";
import { extrairTocar } from "../src/lib/tocar.ts";

const PASTA = new URL("../backend/app/bncc/perguntas/", import.meta.url);
const banco = readdirSync(PASTA)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, PASTA), "utf8")).perguntas);
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

test("tocar: cada opção precisa aparecer uma única vez no texto", () => {
  const t = extrairTocar(comoCliente({ id: "t", enunciado: 'Leia: "Rafael ganhou um cachorro. Ele adora brincar." Qual palavra retoma "Rafael"?', opcoes: ["Ele", "cachorro", "brincar"] }));
  assert.ok(t);
  assert.equal(t.instrucao, 'Qual palavra retoma "Rafael"?');
  assert.equal(t.pedacos.filter((p) => p.opcaoId).length, 3);
  // "o" aparece duas vezes: não dá para saber qual tocar, então vira múltipla escolha.
  assert.equal(extrairTocar(comoCliente({ id: "u", enunciado: 'Leia: "Ana viu o gato e o levou." Qual palavra retoma "gato"?', opcoes: ["o", "Ana", "viu"] })), null);
});

test("banco inteiro: lacunas e toques reconstroem a frase sem perder texto", () => {
  let lacunas = 0;
  let toques = 0;
  for (const p of banco) {
    const q = comoCliente(p);
    const l = extrairLacuna(q);
    if (l) {
      lacunas++;
      const frase = fraseCompleta(l, q.opcoes[p.certa]);
      assert.ok(!/_{2,}/.test(frase), `${p.id}: sobrou buraco em "${frase}"`);
      assert.ok(l.instrucao.length > 3, `${p.id}: instrução vazia`);
      continue;
    }
    const t = extrairTocar(q);
    if (t) {
      toques++;
      const ids = t.pedacos.filter((x) => x.opcaoId).map((x) => x.opcaoId);
      assert.deepEqual([...ids].sort(), q.opcoes.map((o) => o.id).sort(), `${p.id}: opções tocáveis não batem`);
    }
  }
  // Garante que o banco continua com uma boa parte de questões interativas.
  assert.ok(lacunas >= 40, `só ${lacunas} lacunas`);
  assert.ok(toques >= 15, `só ${toques} toques`);
});
