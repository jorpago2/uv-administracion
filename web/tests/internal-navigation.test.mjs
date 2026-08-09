import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORIES } from "../chapter-categories.js";
import { NAV_LANDMARKS, pickCurrentNavigationItem } from "../navigation-model.js";

const html = await readFile(new URL("../consulta.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const manualData = JSON.parse(await readFile(new URL("../data/manual.json", import.meta.url), "utf8"));
const staticIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const chapterIds = [...manualData.markdown.matchAll(/^##\s+\d+\.\s+(.+)$/gm)].map((match) => slugify(match[1]));
const validTargets = new Set([...staticIds, ...chapterIds]);

test("todos los enlaces internos declarados tienen un destino único y real", () => {
  assert.equal(new Set(staticIds).size, staticIds.length, "Hay identificadores HTML duplicados");
  const htmlTargets = [...html.matchAll(/href="#([^"]*)"/g)].map((match) => match[1]);
  const categoryTargets = CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.href)).filter((href) => href.startsWith("#")).map((href) => href.slice(1));
  const navigationTargets = NAV_LANDMARKS.map((item) => item.id);
  const allTargets = [...htmlTargets, ...categoryTargets, ...navigationTargets];
  assert.ok(allTargets.every(Boolean), "Existe al menos un href con destino vacío");
  assert.deepEqual(allTargets.filter((target) => !validTargets.has(target)), []);
  assert.doesNotMatch(styles, /scroll-margin-top/, "El margen del destino no debe duplicar el scroll-padding global");
});

test("el seguimiento selecciona el último bloque que cruza la línea de lectura", () => {
  const items = [
    { id: "inicio", top: -300, order: 0, hidden: false },
    { id: "herramientas", top: 80, order: 1, hidden: false },
    { id: "oculto", top: 90, order: 2, hidden: true },
    { id: "manual", top: 700, order: 3, hidden: false }
  ];
  assert.equal(pickCurrentNavigationItem(items, 96)?.id, "herramientas");
  assert.equal(pickCurrentNavigationItem(items, 20)?.id, "inicio");
});

function slugify(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
