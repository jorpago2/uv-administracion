import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

test("las etiquetas largas se ajustan al ancho disponible", () => {
  const fundingTag = ruleFor(".funding-tag");
  const procedureTag = ruleFor(".procedure-tag");

  for (const rule of [fundingTag, procedureTag]) {
    assert.match(rule, /width:\s*fit-content/);
    assert.match(rule, /max-width:\s*100%/);
    assert.match(rule, /overflow-wrap:\s*anywhere/);
    assert.match(rule, /white-space:\s*normal/);
    assert.doesNotMatch(rule, /width:\s*max-content/);
  }
});

test("las fichas de financiacion usan una sola columna en movil", () => {
  const mobile = mediaBetween("@media (max-width: 39.999rem)", "@media (min-width: 40rem)");
  assert.match(mobile, /\.funding-card__facts\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(mobile, /\.funding-card__facts > div:nth-child\(even\)\s*\{\s*border-inline-start:\s*0/);
});

test("las rejillas densas esperan a disponer de 75 rem", () => {
  const mediumDesktop = mediaBetween("@media (min-width: 60rem)", "@media (min-width: 75rem)");
  const wideDesktop = mediaBetween("@media (min-width: 75rem)", "@media (min-width: 90rem)");

  assert.doesNotMatch(mediumDesktop, /\.procedure-stack--recommended|\.funding-card-list/);
  assert.match(wideDesktop, /\.procedure-stack--recommended[^}]*repeat\(2/);
  assert.match(wideDesktop, /\.funding-card-list[^}]*repeat\(2/);
  assert.match(wideDesktop, /\.funding-planner__basics[^}]*repeat\(3/);
});

test("las nuevas entradas por tareas y ambitos responden sin columnas rigidas", () => {
  const taskLink = ruleFor(".task-grid a");
  const wide = styles.slice(styles.indexOf("@media (min-width: 90rem)"));

  assert.match(taskLink, /min-width:\s*0/);
  assert.match(styles, /\.domain-grid\s*\{[^}]*display:\s*grid/);
  assert.match(wide, /\.task-grid\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)/);
});

test("el glosario pasa de una a dos columnas sin perder controles contraibles", () => {
  const toolbar = ruleFor(".glossary-toolbar");
  const wideDesktop = mediaBetween("@media (min-width: 75rem)", "@media (min-width: 90rem)");

  assert.match(toolbar, /display:\s*grid/);
  assert.match(styles, /\.glossary-toolbar input, \.glossary-toolbar select\s*\{[^}]*min-width:\s*0/);
  assert.match(ruleFor(".glossary-card"), /min-width:\s*0/);
  assert.match(wideDesktop, /\.glossary-list\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)/);
  assert.match(wideDesktop, /\.glossary-card\[open\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/);
});

test("el planificador puede contraerse sin desbordar", () => {
  assert.match(styles, /\.funding-plan-output > \*,[^}]*min-width:\s*0/);
  assert.match(ruleFor(".funding-plan-result"), /min-width:\s*0/);
  assert.match(styles, /\n\.funding-plan-actions \.control\s*\{[^}]*max-width:\s*100%/);
  assert.match(ruleFor(".funding-eligibility-badge"), /overflow-wrap:\s*anywhere/);
});

test("las calculadoras conservan una columna contraíble en móvil", () => {
  assert.match(ruleFor(".decision-tools"), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /\.decision-form input\[type="datetime-local"\][^{]*\{[^}]*max-width:\s*100%/);
});

test("el menu movil queda fuera del foco cuando esta cerrado", () => {
  assert.match(app, /syncMenuMode\(\);/);
  assert.match(app, /indexPanel\.toggleAttribute\("inert",\s*!desktop && !open\)/);
  assert.match(app, /indexPanel\.setAttribute\("aria-hidden",\s*String\(!open\)\)/);
  assert.match(app, /indexPanel\.removeAttribute\("inert"\)/);
});

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`));
  assert.ok(match, `No se encuentra la regla ${selector}`);
  return match[0];
}

function mediaBetween(startMarker, endMarker) {
  const start = styles.indexOf(startMarker);
  const end = styles.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `No se encuentra ${startMarker}`);
  assert.ok(end > start, `No se encuentra ${endMarker} despues de ${startMarker}`);
  return styles.slice(start, end);
}
