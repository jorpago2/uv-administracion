import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORIES } from "../chapter-categories.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const glossary = await readFile(new URL("../glossary.js", import.meta.url), "utf8");
const decisionTools = await readFile(new URL("../decision-tools.js", import.meta.url), "utf8");
const favicon = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
const cases = JSON.parse(await readFile(new URL("../data/decision-cases.json", import.meta.url), "utf8"));

test("la identidad visual incluye un favicon vectorial integrado", () => {
  assert.match(html, /<link rel="icon" href="favicon\.svg" type="image\/svg\+xml" sizes="any">/);
  assert.match(html, /<meta name="theme-color" content="#f5d328">/);
  assert.match(favicon, /<svg[^>]+viewBox="0 0 64 64"/);
  assert.match(favicon, />Guía operativa UV</);
});

test("los seis ambitos comparten una ficha de navegacion completa", () => {
  assert.equal(CATEGORIES.length, 6);
  for (const category of CATEGORIES) {
    assert.ok(category.shortLabel.length > 0, category.id);
    assert.ok(category.summary.length > 30, category.id);
    assert.ok(category.featuredSections.length >= 2, category.id);
    assert.ok(category.featuredSections.every((number) => category.sections.includes(number)), category.id);
    assert.ok(category.tools.length >= 3, category.id);
    assert.ok(category.tools.every((tool) => tool.label && /^(#|ALERTAS\.md)/.test(tool.href)), category.id);
  }
});

test("la portada prioriza tareas, alertas y ambitos antes de las herramientas", () => {
  const situationIndex = html.indexOf('id="situaciones"');
  const glossaryIndex = html.indexOf('id="glosario"');
  const taskIndex = html.indexOf('id="tareas-frecuentes"');
  const alertIndex = html.indexOf('class="attention-strip"');
  const domainIndex = html.indexOf('id="ambitos"');
  const toolsIndex = html.indexOf('id="herramientas-operativas"');

  assert.ok(situationIndex > 0);
  assert.ok(situationIndex < glossaryIndex && glossaryIndex < taskIndex && taskIndex < alertIndex && alertIndex < domainIndex && domainIndex < toolsIndex);
  assert.equal((html.match(/class="task-grid"[\s\S]+?<\/nav>/)?.[0].match(/<a href=/g) ?? []).length, 8);
  assert.match(html, /id="domainDirectory"/);
  assert.match(html, /id="indice-capitulos"/);
});

test("las cincuenta situaciones son una entrada principal y buscable", () => {
  assert.match(html, /<section class="situations" id="situaciones"/);
  assert.match(html, /id="situationQuery"[^>]+type="search"/);
  assert.match(html, /id="situationCategory"/);
  assert.match(app, /initSituationDirectory/);
  assert.match(app, /situationGlobalSearchItems\(\)/);
});

test("el glosario es una entrada principal, descargable y buscable", () => {
  assert.match(html, /<section class="glossary" id="glosario"/);
  assert.match(html, /href="GLOSARIO_PDI\.md"/);
  assert.match(html, /id="glossaryQuery"[^>]+type="search"/);
  assert.match(html, /id="glossaryCategory"/);
  assert.match(app, /glossarySearchItems\(\)/);
  assert.match(app, /glossaryController\.focusTerm/);
  assert.match(glossary, /termIdFromHash\(window\.location\.hash\)/);
});

test("la portada identifica el uso personal y el caracter no oficial", () => {
  assert.match(html, /class="personal-use-notice"/);
  assert.match(html, /uso personal de <a href="https:\/\/www\.uv\.es\/jorpago2">Jorge Parra<\/a>/i);
  assert.equal((html.match(/href="https:\/\/www\.uv\.es\/jorpago2">Jorge Parra<\/a>/g) ?? []).length, 3);
  assert.match(html, /No constituye asesoramiento, recomendación, instrucción administrativa ni interpretación oficial/);
  assert.match(html, /Puede contener errores, omisiones o información incompleta o desactualizada/);
  assert.match(html, /verifica siempre la norma, convocatoria, sede, plazo y criterio vigentes/);
  assert.match(html, /<footer class="colophon">[\s\S]*contenido no oficial/);
});

test("el indice lateral se genera por ambitos y conserva los enlaces profundos", () => {
  assert.match(app, /function renderDomainDirectory\(/);
  assert.match(app, /document\.createElement\("details"\)/);
  assert.match(app, /dataIndexCategory|dataset\.indexCategory/);
  assert.match(app, /function setActiveFilter\(/);
  assert.match(app, /function setupScrollSpy\(/);
  assert.match(app, /target\?\.matches\("\.chapter"\)/);
});

test("los casos realistas se pueden consultar por su ambito", () => {
  assert.equal(cases.cases.length, 8);
  assert.deepEqual(new Set(cases.cases.map((item) => item.category)), new Set(["docencia", "investigacion", "gestion", "cumplimiento"]));
  assert.match(html, /class="case-filters"/);
  assert.match(decisionTools, /function handleCaseFilter\(/);
  assert.match(decisionTools, /dataset\.caseCategory/);
});
