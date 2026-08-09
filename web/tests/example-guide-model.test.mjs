import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExampleGuides, findExampleGuide } from "../example-guide-model.js";

const manual = JSON.parse(await readFile(new URL("../data/manual.json", import.meta.url), "utf8"));
const operations = JSON.parse(await readFile(new URL("../data/operations.json", import.meta.url), "utf8"));
const guides = buildExampleGuides(manual.markdown, operations.procedures);

test("genera una guía detallada para cada ejemplo realista", () => {
  assert.equal(guides.length, 32);
  assert.equal(new Set(guides.map((guide) => guide.id)).size, guides.length);
  assert.deepEqual(guides.map((guide) => guide.chapterNumber), [5, 6, ...Array.from({ length: 30 }, (_, index) => index + 8)]);
});

test("cada guía ofrece orientación suficiente para una persona principiante", () => {
  for (const guide of guides) {
    assert.ok(guide.scenario.length > 80, `escenario ${guide.chapterNumber}`);
    assert.ok(guide.outcome.length > 70, `resultado ${guide.chapterNumber}`);
    assert.ok(guide.firstMove.length > 60, `primer paso ${guide.chapterNumber}`);
    assert.ok(guide.questions.length >= 3, `preguntas ${guide.chapterNumber}`);
    assert.ok(guide.documents.length >= 4, `documentos ${guide.chapterNumber}`);
    assert.ok(guide.steps.length >= 3, `pasos ${guide.chapterNumber}`);
    assert.ok(guide.successChecks.length >= 3, `controles ${guide.chapterNumber}`);
    assert.ok(guide.risks.length >= 2, `riesgos ${guide.chapterNumber}`);
  }
});

test("todas las guías enlazan fuentes oficiales seguras", () => {
  for (const guide of guides) {
    assert.ok(guide.sources.length >= 1, `fuentes ${guide.chapterNumber}`);
    assert.ok(guide.sources.every((source) => source.label && /^https:\/\//.test(source.url)), `URL ${guide.chapterNumber}`);
  }
});

test("localiza una guía por capítulo y rechaza identificadores inválidos", () => {
  assert.equal(findExampleGuide(guides, "24").title, "Publicación frente a patente");
  assert.equal(findExampleGuide(guides, "no"), null);
  assert.equal(findExampleGuide(guides, "7"), null);
});
