import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORIES } from "../chapter-categories.js";

const manual = await readFile(new URL("../../MANUAL_PROCEDIMIENTOS.md", import.meta.url), "utf8");
const chapterNumbers = [...manual.matchAll(/^## (\d+)\. /gm)].map((match) => Number(match[1]));

test("el manual contiene 37 capítulos consecutivos", () => {
  assert.deepEqual(chapterNumbers, Array.from({ length: 37 }, (_, index) => index + 1));
});

test("cada capítulo pertenece exactamente a un ámbito", () => {
  const categorized = CATEGORIES.flatMap((category) => category.sections);
  assert.deepEqual(categorized, chapterNumbers);
  assert.equal(new Set(categorized).size, categorized.length);
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
