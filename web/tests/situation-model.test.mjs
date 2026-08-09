import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExampleGuides } from "../example-guide-model.js";
import { buildSituationGuides, findSituationGuide, searchSituationGuides, situationSearchItems } from "../situation-model.js";

const situations = JSON.parse(await readFile(new URL("../data/situations.json", import.meta.url), "utf8"));
const manual = JSON.parse(await readFile(new URL("../data/manual.json", import.meta.url), "utf8"));
const operations = JSON.parse(await readFile(new URL("../data/operations.json", import.meta.url), "utf8"));
const baseGuides = buildExampleGuides(manual.markdown, operations.procedures);
const guides = buildSituationGuides(situations, baseGuides);

test("las cincuenta situaciones forman un catalogo completo y consecutivo", () => {
  assert.equal(guides.length, 50);
  assert.deepEqual(guides.map((guide) => guide.situationNumber), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.equal(new Set(guides.map((guide) => guide.id)).size, 50);
  assert.deepEqual(new Set(guides.map((guide) => guide.categoryId)), new Set(situations.categories.map((category) => category.id)));
});

test("ninguna situacion se presenta como resuelta sin decisiones, paradas, cierre y escalado", () => {
  for (const guide of guides) {
    assert.ok(guide.outcome.length >= 20, guide.id);
    assert.ok(guide.firstMove.length >= 20, guide.id);
    assert.ok(guide.questions.length >= 3, guide.id);
    assert.ok(guide.responsibilities.length >= 2, guide.id);
    assert.ok(guide.documents.length >= 4, guide.id);
    assert.ok(guide.steps.length >= 3, guide.id);
    assert.ok(guide.decisionRules.length >= 2, guide.id);
    assert.ok(guide.stopConditions.length >= 2, guide.id);
    assert.ok(guide.completionEvidence.length >= 3, guide.id);
    assert.ok(guide.escalation.length >= 2, guide.id);
    assert.ok(guide.sources.length >= 1, guide.id);
    assert.ok(guide.sources.every((source) => /^https:\/\//.test(source.url)), guide.id);
  }
});

test("los dos huecos originales tienen rutas completas y fuentes UV", () => {
  for (const id of ["incorporacion-inicial", "datos-personales-bancarios-irpf"]) {
    const guide = findSituationGuide(guides, id);
    assert.ok(guide, id);
    assert.ok(guide.steps.every((step) => typeof step === "object" && step.action && step.evidence), id);
    assert.ok(guide.sources.every((source) => new URL(source.url).hostname.endsWith("uv.es")), id);
  }
});

test("el buscador entiende objetivos, siglas y ejemplos concretos", () => {
  assert.equal(searchSituationGuides(guides, "lente thorlabs")[0].id, "comprar-lente-sda");
  assert.equal(searchSituationGuides(guides, "cambiar irpf")[0].id, "datos-personales-bancarios-irpf");
  assert.equal(searchSituationGuides(guides, "plagio inteligencia artificial")[0].id, "copia-plagio-ia");
  assert.ok(searchSituationGuides(guides, "", "docencia").every((guide) => guide.categoryId === "docencia"));
});

test("las situaciones generan entradas profundas para el buscador global", () => {
  const entries = situationSearchItems(guides);
  assert.equal(entries.length, 50);
  assert.ok(entries.every((entry) => /^example\.html\?caso=/.test(entry.href)));
  assert.ok(entries.every((entry) => entry.title && entry.category && entry.content.length > 100));
});
