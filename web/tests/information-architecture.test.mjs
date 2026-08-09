import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORIES } from "../chapter-categories.js";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const legacyHtml = await readFile(new URL("../consulta.html", import.meta.url), "utf8");
const resolverHtml = await readFile(new URL("../resolver/index.html", import.meta.url), "utf8");
const auditHtml = await readFile(new URL("../auditoria/index.html", import.meta.url), "utf8");
const glossaryHtml = await readFile(new URL("../glosario/index.html", import.meta.url), "utf8");
const manualHtml = await readFile(new URL("../manual/index.html", import.meta.url), "utf8");
const areaPage = await readFile(new URL("../area-page.js", import.meta.url), "utf8");
const careerPlanHtml = await readFile(new URL("../plan-carrera/index.html", import.meta.url), "utf8");
const careerPlanPage = await readFile(new URL("../career-roadmap-page.js", import.meta.url), "utf8");
const researchArea = await readFile(new URL("../investigacion/index.html", import.meta.url), "utf8");
const manualPage = await readFile(new URL("../manual-page.js", import.meta.url), "utf8");
const resolverPage = await readFile(new URL("../resolver-page.js", import.meta.url), "utf8");
const situationsPage = await readFile(new URL("../situations.js", import.meta.url), "utf8");
const auditPage = await readFile(new URL("../content-audit-page.js", import.meta.url), "utf8");
const examplePage = await readFile(new URL("../example-page.js", import.meta.url), "utf8");
const glossary = await readFile(new URL("../glossary.js", import.meta.url), "utf8");
const decisionTools = await readFile(new URL("../decision-tools.js", import.meta.url), "utf8");
const favicon = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
const cases = JSON.parse(await readFile(new URL("../data/decision-cases.json", import.meta.url), "utf8"));

test("la identidad visual incluye un favicon vectorial integrado", () => {
  assert.match(html, /<link rel="icon" href="favicon\.svg" type="image\/svg\+xml" sizes="any">/);
  assert.match(html, /<meta name="theme-color" content="#f5d328">/);
  assert.match(favicon, /<svg[^>]+viewBox="0 0 64 64"/);
});

test("los seis ambitos comparten una ficha de navegacion completa", () => {
  assert.equal(CATEGORIES.length, 6);
  for (const category of CATEGORIES) {
    assert.ok(category.shortLabel.length > 0, category.id);
    assert.ok(category.summary.length > 30, category.id);
    assert.ok(category.featuredSections.length >= 2, category.id);
    assert.ok(category.featuredSections.every((number) => category.sections.includes(number)), category.id);
    assert.ok(category.tools.length >= 3, category.id);
  }
});

test("la portada prioriza buscar, actuar y explorar antes de la consulta", () => {
  const searchIndex = html.indexOf('class="hub-search"');
  const personalNoticeIndex = html.indexOf('class="personal-notice');
  const actionIndex = html.indexOf('class="hub-actions"');
  const domainIndex = html.indexOf('class="hub-domains"');
  const referenceIndex = html.indexOf('class="hub-reference"');
  assert.ok(searchIndex > 0 && searchIndex < actionIndex && actionIndex < domainIndex && domainIndex < referenceIndex);
  assert.ok(searchIndex < personalNoticeIndex, "la búsqueda debe estar antes del aviso extenso en móvil");
  assert.match(html, /<dt>Situaciones<\/dt><dd>105<\/dd>/);
  assert.match(html, /href="resolver\/"/);
  assert.match(html, /href="plan-carrera\/"/);
  for (const route of ["administracion", "docencia", "carrera-pdi", "investigacion", "gestion", "cumplimiento"]) assert.match(html, new RegExp(`href="${route}/"`));
  assert.match(html, /href="consulta\.html"/);
});

test("la carrera PDI incluye un plan personal sin presentar hipótesis como hechos", () => {
  const pdiCategory = CATEGORIES.find((category) => category.id === "pdi");
  assert.ok(pdiCategory.tools.some((tool) => tool.href === "../plan-carrera/"));
  assert.match(careerPlanHtml, /id="careerProfileForm"/);
  assert.match(careerPlanHtml, /id="careerRoadmap"/);
  assert.match(careerPlanHtml, /id="opportunityForm"/);
  assert.match(careerPlanHtml, /No garantiza acreditación, plaza o promoción/);
  assert.match(careerPlanPage, /localStorage/);
  assert.match(careerPlanPage, /exportCareerRoadmapMarkdown/);
});

test("las 105 situaciones tienen una subweb principal y buscable", () => {
  assert.match(resolverHtml, /id="situaciones"/);
  assert.match(resolverHtml, /id="situationQuery"[^>]+type="search"/);
  assert.match(resolverHtml, /id="situationCategory"/);
  assert.match(resolverPage, /initSituationDirectory/);
  assert.match(resolverHtml, /105 situaciones reales/);
  assert.match(resolverHtml, /href="\.\.\/auditoria\/"/);
  assert.match(auditHtml, /id="auditCaseList"/);
  assert.match(html, /href="auditoria\/"/);
  assert.ok(resolverHtml.indexOf('id="situaciones"') < resolverHtml.indexOf('class="resolver-audit-callout"'));
  assert.match(situationsPage, /visibleLimit/);
  assert.match(situationsPage, /Mostrar \$\{Math\.min\(pageSize, remaining\)\} más/);
  assert.match(auditPage, /const PAGE_SIZE = 8/);
  assert.ok(auditHtml.indexOf('class="audit-catalogue"') < auditHtml.indexOf('class="audit-overview"'));
});

test("las guías largas permiten explorar por capas y siguen la sección visible", () => {
  assert.match(examplePage, /const GUIDE_SECTIONS/);
  assert.match(examplePage, /IntersectionObserver/);
  assert.match(examplePage, /aria-current/);
  assert.match(examplePage, /context-disclosure/);
  assert.match(examplePage, /className = "action-link"/);
});

test("la vista completa se identifica como pesada y ofrece alternativas", () => {
  assert.match(html, /Vista completa · pesada/);
  assert.match(legacyHtml, /Vista excepcional · carga pesada/);
  assert.match(legacyHtml, /href="resolver\/"/);
});

test("el glosario tiene una subweb filtrable y enlazable", () => {
  assert.match(glossaryHtml, /id="glosario"/);
  assert.match(glossaryHtml, /id="glossaryQuery"[^>]+type="search"/);
  assert.match(glossaryHtml, /id="glossaryCategory"/);
  assert.match(glossary, /termIdFromHash\(window\.location\.hash\)/);
});

test("la portada identifica el uso personal y el caracter no oficial", () => {
  assert.match(html, /class="personal-notice personal-use-notice"/);
  assert.match(html, /Uso exclusivamente personal de <a href="https:\/\/www\.uv\.es\/jorpago2">Jorge Parra<\/a>/);
  assert.match(html, /No es una web oficial ni contiene recomendaciones/);
  assert.match(html, /Puede incluir errores o información desactualizada/);
  assert.match(html, /Prevalecen siempre las fuentes oficiales/);
});

test("cada ambito filtra sus casos y enlaza sus capitulos", () => {
  assert.match(areaPage, /guideBelongsToArea\(guide, areaId\)/);
  assert.match(areaPage, /\.\.\/manual\/#/);
  assert.match(areaPage, /\.\.\/example\.html\?caso=/);
});

test("investigación declara el perfil ICMUV y el ciclo completo de dispositivos", () => {
  assert.match(researchArea, /id="researchProfile"/);
  assert.match(areaPage, /personalResearchData\.themes/);
  assert.match(areaPage, /research-cycle/);
});

test("el manual conserva visible la ubicacion y sigue el capitulo al desplazarse", () => {
  assert.match(manualHtml, /id="manualCurrent"/);
  assert.match(manualPage, /IntersectionObserver/);
  assert.match(manualPage, /aria-current/);
});

test("los casos realistas se pueden consultar por su ambito", () => {
  assert.equal(cases.cases.length, 8);
  assert.deepEqual(new Set(cases.cases.map((item) => item.category)), new Set(["docencia", "investigacion", "gestion", "cumplimiento"]));
  assert.match(legacyHtml, /class="case-filters"/);
  assert.match(decisionTools, /function handleCaseFilter\(/);
  assert.match(decisionTools, /dataset\.caseCategory/);
});
