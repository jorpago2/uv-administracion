import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORIES } from "../chapter-categories.js";

const manual = await readFile(new URL("../../MANUAL_PROCEDIMIENTOS.md", import.meta.url), "utf8");

test("documenta el flujo SDA de material de laboratorio de 2026", () => {
  assert.match(manual, /### 29\.2 SDA de material de laboratorio y gases/);
  assert.match(manual, /Modulo-Pedidos-Gestion\.pdf/);
  assert.match(manual, /Atención a manuales antiguos/);
  assert.match(manual, /Gases de laboratorio/);
});
const chapterNumbers = [...manual.matchAll(/^## (\d+)\. /gm)].map((match) => Number(match[1]));

test("el manual contiene 37 capítulos consecutivos", () => {
  assert.deepEqual(chapterNumbers, Array.from({ length: 37 }, (_, index) => index + 1));
});

test("cada capítulo pertenece exactamente a un ámbito", () => {
  const categorized = CATEGORIES.flatMap((category) => category.sections);
  assert.deepEqual([...categorized].sort((left, right) => left - right), chapterNumbers);
  assert.equal(new Set(categorized).size, categorized.length);
});

test("el doctorado se clasifica como investigación y no como docencia", () => {
  assert.ok(CATEGORIES.find((category) => category.id === "investigacion").sections.includes(15));
  assert.ok(!CATEGORIES.find((category) => category.id === "docencia").sections.includes(15));
});

test("la numeración de los subapartados coincide con su capítulo", () => {
  let currentChapter = 0;
  for (const line of manual.split(/\r?\n/)) {
    const chapter = line.match(/^## (\d+)\. /);
    if (chapter) currentChapter = Number(chapter[1]);
    const subsection = line.match(/^### (\d+)\./);
    if (subsection) assert.equal(Number(subsection[1]), currentChapter, line);
  }
});

test("los 32 capítulos operativos incluyen un ejemplo realista", () => {
  const exampleCount = (manual.match(/^> \*\*Ejemplo realista/gm) ?? []).length;
  assert.equal(exampleCount, 32);
});

test("el capítulo de financiación cubre las cinco vías solicitadas y la selección previa", () => {
  const chapter = manual.match(/^## 20\. [\s\S]+?(?=^## 21\.)/m)?.[0] ?? "";
  for (const expected of ["Unión Europea", "Estado", "Comunitat Valenciana", "Universitat de València", "Fundaciones y entidades privadas"]) {
    assert.match(chapter, new RegExp(expected), expected);
  }
  assert.match(chapter, /go\/no-go/i);
  assert.match(chapter, /plazo interno/i);
});

test("las tablas de financiación comparan las convocatorias recurrentes clave", () => {
  const chapter = manual.match(/^## 20\. [\s\S]+?(?=^## 21\.)/m)?.[0] ?? "";
  for (const expected of [
    "ERC Starting Grant",
    "EIC Pathfinder",
    "Proyectos de Generación de Conocimiento",
    "Grupos emergentes",
    "Grupos consolidados",
    "PROMETEO",
    "Captación de proyectos europeos",
  ]) {
    assert.match(chapter, new RegExp(expected, "i"), expected);
  }
  assert.match(chapter, /duración/i);
  assert.match(chapter, /indirectos/i);
  assert.match(chapter, /no necesariamente anual/i);
});
