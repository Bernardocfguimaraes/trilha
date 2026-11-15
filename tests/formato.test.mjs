import { test } from "node:test";
import assert from "node:assert/strict";
import { hojeLocal, somarDias } from "../src/lib/formato.ts";

test("hoje no fuso de São Paulo, no formato AAAA-MM-DD", () => {
  assert.match(hojeLocal(), /^\d{4}-\d{2}-\d{2}$/);
});

test("somar dias atravessa meses e anos", () => {
  assert.equal(somarDias("2026-10-13", 33), "2026-11-15");
  assert.equal(somarDias("2026-12-30", 3), "2027-01-02");
  assert.equal(somarDias("2026-11-15", -7), "2026-11-08");
});

test("dias entre duas datas", async () => {
  const { diasEntre } = await import("../src/lib/formato.ts");
  assert.equal(diasEntre("2026-10-13", "2026-11-15"), 33);
  assert.equal(diasEntre("2026-11-15", "2026-11-15"), 0);
});

test("recomendação sem IA cita a habilidade e muda com o status", async () => {
  const { recomendacaoPadrao } = await import("../src/lib/recomendacao-padrao.ts");
  const alerta = recomendacaoPadrao("Frações simples", "Matemática", "alerta");
  const atencao = recomendacaoPadrao("Frações simples", "Matemática", "atencao");
  assert.ok(alerta.includes("“Frações simples”") && alerta !== atencao);
  assert.ok(recomendacaoPadrao("Cores", "Arte", "alerta").includes("“Cores”"));
});
