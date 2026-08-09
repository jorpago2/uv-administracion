import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CHAPTER_ANCHORS, chapterHref } from "../chapter-links.js";

const glossary = JSON.parse(await readFile(new URL("../data/glossary.json", import.meta.url), "utf8"));
const manual = await readFile(new URL("../../MANUAL_PROCEDIMIENTOS.md", import.meta.url), "utf8");
const termsById = new Map(glossary.terms.map((item) => [item.id, item]));

test("el glosario ofrece cobertura amplia y entradas completas", () => {
  assert.equal(glossary.schemaVersion, 1);
  assert.equal(glossary.categories.length, 6);
  assert.ok(glossary.terms.length >= 60);
  assert.equal(termsById.size, glossary.terms.length, "Hay identificadores duplicados");

  const categories = new Set(glossary.categories.map((item) => item.id));
  for (const item of glossary.terms) {
    assert.ok(categories.has(item.category), item.id);
    assert.ok(item.term.length >= 2, item.id);
    assert.ok(item.definition.length >= 45, item.id);
    assert.ok(item.practical.length >= 35, item.id);
    assert.ok(item.caution.length >= 35, item.id);
    assert.ok(item.aliases?.length >= 1, item.id);
    assert.ok(item.sourceIds?.length >= 1, item.id);
    assert.ok(item.sourceIds.every((sourceId) => glossary.sources[sourceId]), item.id);
    assert.ok(item.chapters?.every((number) => CHAPTER_ANCHORS[number]), item.id);
  }
});

test("las fuentes son HTTPS y pertenecen a organismos oficiales", () => {
  const officialHosts = ["uv.es", "boe.es", "europa.eu", "aneca.es"];
  for (const [sourceId, source] of Object.entries(glossary.sources)) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:", sourceId);
    assert.ok(officialHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)), `${sourceId}: ${url.hostname}`);
  }
});

test("incluye el vocabulario esencial de una incorporacion PDI", () => {
  const essentialIds = [
    "pdi", "ptgas", "unidad-gestora", "organo-competente", "expediente", "registro-electronico", "subsanacion",
    "dias-habiles", "caja-fija", "anticipo-caja-fija", "documento-ad", "contrato-menor", "sda", "uv-plyca",
    "gasto-elegible", "oca", "pod", "sgi", "trl", "sexenio", "dpd", "ceih", "prl"
  ];
  for (const id of essentialIds) assert.ok(termsById.has(id), `Falta ${id}`);
});

test("caja fija distingue pago, anticipo, reintegro y compensacion interna", () => {
  const cajaFija = termsById.get("caja-fija");
  const anticipo = termsById.get("anticipo-caja-fija");
  const reintegro = termsById.get("reintegro");
  const compensacion = termsById.get("compensacion-interna");

  assert.match(cajaFija.definition, /Sistema de pago/i);
  assert.match(cajaFija.caution, /No es una caja, cuenta o tarjeta personal/i);
  assert.match(anticipo.practical, /15 días posteriores/i);
  assert.match(reintegro.caution, /no crea automáticamente derecho al reintegro/i);
  assert.match(compensacion.practical, /vía exclusiva.*propia UV/i);
  assert.match(compensacion.caution, /no puede reintegrarse/i);
});

test("cada enlace de capitulo apunta al encabezado canonico del manual", () => {
  const headings = [...manual.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  assert.equal(headings.length, 37);
  for (const [, number, title] of headings) {
    const expected = slugify(title);
    assert.equal(CHAPTER_ANCHORS[Number(number)], expected, `Capítulo ${number}`);
    assert.equal(chapterHref(Number(number)), `#${expected}`);
  }
});

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
