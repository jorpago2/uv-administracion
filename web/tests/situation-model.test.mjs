import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildExampleGuides } from "../example-guide-model.js";
import { buildSituationGuides, combineSituationCatalogs, findSituationGuide, searchSituationGuides, situationSearchItems } from "../situation-model.js";

const situations = JSON.parse(await readFile(new URL("../data/situations.json", import.meta.url), "utf8"));
const situationsExtension = JSON.parse(await readFile(new URL("../data/situations-51-100.json", import.meta.url), "utf8"));
const situationsSpecialised = JSON.parse(await readFile(new URL("../data/situations-101-104.json", import.meta.url), "utf8"));
const situationsBudget = JSON.parse(await readFile(new URL("../data/situations-105.json", import.meta.url), "utf8"));
const manual = JSON.parse(await readFile(new URL("../data/manual.json", import.meta.url), "utf8"));
const operations = JSON.parse(await readFile(new URL("../data/operations.json", import.meta.url), "utf8"));
const academicContext = JSON.parse(await readFile(new URL("../data/academic-situation-context.json", import.meta.url), "utf8"));
const academicProgrammes = JSON.parse(await readFile(new URL("../data/academic-programmes.json", import.meta.url), "utf8"));
const personalResearch = JSON.parse(await readFile(new URL("../data/personal-research-context.json", import.meta.url), "utf8"));
const baseGuides = buildExampleGuides(manual.markdown, operations.procedures);
const catalog = combineSituationCatalogs(situations, situationsExtension, situationsSpecialised, situationsBudget);
const guides = buildSituationGuides(catalog, baseGuides, academicContext, personalResearch);

test("las 105 situaciones forman un catálogo completo y consecutivo", () => {
  assert.equal(guides.length, 105);
  assert.deepEqual(guides.map((guide) => guide.situationNumber), Array.from({ length: 105 }, (_, index) => index + 1));
  assert.equal(new Set(guides.map((guide) => guide.id)).size, 105);
  assert.deepEqual(new Set(guides.map((guide) => guide.categoryId)), new Set(catalog.categories.map((category) => category.id)));
});

test("ninguna situacion se presenta como resuelta sin decisiones, paradas, cierre y escalado", () => {
  for (const guide of guides) {
    assert.ok(guide.outcome.length >= 20, guide.id);
    assert.ok(guide.firstMove.length >= 20, guide.id);
    assert.ok(guide.questions.length >= 3, guide.id);
    assert.ok(guide.responsibilities.length >= 2, guide.id);
    assert.ok(guide.documents.length >= 4, guide.id);
    assert.ok(guide.steps.length >= 3, guide.id);
    if (guide.situationNumber >= 51) {
      assert.ok(guide.steps.slice(0, 5).every((step) => typeof step === "object" && step.action && step.evidence), guide.id);
      assert.ok(guide.sources.length >= 2, guide.id);
    }
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

test("los casos ampliados no heredan pasos ni fuentes ajenos del ejemplo del capítulo", () => {
  const guide = findSituationGuide(guides, "pagar-factura-proforma-anticipo-proveedor");
  assert.equal(guide.steps.length, 5);
  assert.equal(guide.sources.length, 2);
  assert.ok(guide.sources.every((source) => !source.url.includes("/SDA/")));
  assert.ok(guide.documents.length <= 10);
});

test("el buscador entiende objetivos, siglas y ejemplos concretos", () => {
  assert.equal(searchSituationGuides(guides, "lente thorlabs")[0].id, "comprar-lente-sda");
  assert.equal(searchSituationGuides(guides, "cambiar irpf")[0].id, "datos-personales-bancarios-irpf");
  assert.equal(searchSituationGuides(guides, "plagio inteligencia artificial")[0].id, "copia-plagio-ia");
  assert.equal(searchSituationGuides(guides, "factura proforma anticipo")[0].id, "pagar-factura-proforma-anticipo-proveedor");
  assert.equal(searchSituationGuides(guides, "revista depredadora")[0].id, "detectar-revista-congreso-depredador");
  assert.equal(searchSituationGuides(guides, "regalo proveedor")[0].id, "aceptar-regalo-invitacion-proveedor");
  assert.equal(searchSituationGuides(guides, "acuerdo NDA MTA")[0].id, "firmar-nda-mta-dta");
  assert.equal(searchSituationGuides(guides, "acceso LFNN sala limpia")[0].id, "acceso-lfnn-sala-limpia");
  assert.equal(searchSituationGuides(guides, "foundry MPW GDS")[0].id, "fabricacion-foundry-run");
  assert.equal(searchSituationGuides(guides, "licencia HPC nube")[0].id, "licencia-simulacion-calculo-nube");
  assert.equal(searchSituationGuides(guides, "dinero anual PDI fondos docencia")[0].id, "saber-fondos-disponibles-docencia-investigacion");
  assert.ok(searchSituationGuides(guides, "", "docencia").every((guide) => guide.categoryId === "docencia"));
});

test("el buscador exige todos los términos relevantes y evita ruido", () => {
  const expectations = [
    ["foundry MPW GDS", "fabricacion-foundry-run", 1],
    ["incorporar estudiante laboratorio", "incorporar-estudiante-laboratorio", 1],
    ["licencia HPC nube", "licencia-simulacion-calculo-nube", 1],
    ["quiero comprar una lente de thorlabs", "comprar-lente-sda", 1]
  ];
  for (const [query, expectedId, maximumResults] of expectations) {
    const matches = searchSituationGuides(guides, query);
    assert.equal(matches[0]?.id, expectedId, query);
    assert.ok(matches.length <= maximumResults, `${query}: ${matches.length} resultados`);
  }
});

test("los casos docentes, POD y doctorado están adaptados a ETSE, DIE y sus programas", () => {
  const contextualised = guides.filter((guide) => guide.academicContext);
  const teaching = guides.filter((guide) => guide.categoryId === "docencia");
  const programmeIds = new Set(academicProgrammes.programmes.map((programme) => programme.id));
  const programmeById = new Map(academicProgrammes.programmes.map((programme) => [programme.id, programme]));
  assert.equal(teaching.length, 20);
  assert.equal(contextualised.length, 23);
  assert.ok(teaching.every((guide) => guide.academicContext), "todos los casos docentes deben tener contexto académico");
  assert.deepEqual(contextualised.filter((guide) => guide.categoryId !== "docencia").map((guide) => guide.id), ["corregir-pod-oca", "seguimiento-deposito-tesis", "incorporar-estudiante-laboratorio"]);
  for (const guide of contextualised) {
    assert.ok(guide.academicContext.programmeIds.every((id) => programmeIds.has(id)), guide.id);
    assert.ok(guide.academicContext.documentTypes.length >= 2, guide.id);
    for (const programmeId of guide.academicContext.programmeIds) {
      const documentTypes = new Set(programmeById.get(programmeId).documents.map((document) => document.type));
      assert.ok(guide.academicContext.documentTypes.every((type) => documentTypes.has(type)), `${guide.id} · ${programmeId}`);
    }
    assert.ok(guide.academicContext.differences.length >= 2, guide.id);
    assert.ok(guide.academicContext.authority.length > 80, guide.id);
    assert.ok(guide.academicContext.example.length > 150, guide.id);
    assert.ok(guide.academicContext.approvalGate.length > 70, guide.id);
  }
  assert.deepEqual(findSituationGuide(guides, "seguimiento-deposito-tesis").academicContext.programmeIds, ["die-doctorado"]);
  assert.match(findSituationGuide(guides, "practicas-externas").academicContext.programmeNotes.muie, /condicionada/i);
});

test("el perfil ICMUV contextualiza todo el ciclo investigador y la gestión experimental", () => {
  const contextualised = guides.filter((guide) => guide.personalResearchContext);
  const stageIds = new Set(personalResearch.stages.map((stage) => stage.id));
  const resourceIds = new Set(personalResearch.resources.map((resource) => resource.id));
  assert.equal(contextualised.length, 71);
  assert.ok(guides.filter((guide) => guide.categoryId === "investigacion").every((guide) => guide.personalResearchContext));
  assert.ok(guides.filter((guide) => guide.categoryId === "gestion").every((guide) => guide.personalResearchContext));
  for (const guide of contextualised) {
    assert.ok(guide.personalResearchContext.stages.every((id) => stageIds.has(id)), guide.id);
    assert.ok(guide.personalResearchContext.resourceIds.every((id) => resourceIds.has(id)), guide.id);
    assert.ok(guide.personalResearchContext.application.length >= 80, guide.id);
    assert.ok(guide.personalResearchContext.example.length >= 80, guide.id);
  }
  assert.equal(findSituationGuide(guides, "etica-personas-muestras").personalResearchContext.fit, "conditional");
  assert.match(findSituationGuide(guides, "presupuesto-proyecto").personalResearchContext.example, /chip|acoplo|electrónica/i);
  assert.match(findSituationGuide(guides, "proteger-patente").personalResearchContext.example, /VO₂|silicio|memoria/i);
  const purchaseOutcomes = ["comprar-lente-sda", "compra-menor-5000", "compra-desde-5000", "proveedor-exclusivo"].map((id) => findSituationGuide(guides, id).outcome);
  assert.equal(new Set(purchaseOutcomes).size, purchaseOutcomes.length);
  assert.match(findSituationGuide(guides, "presupuesto-proyecto").outcome, /diseño.*simulación.*fabricación.*caracterización/i);
  assert.match(findSituationGuide(guides, "comprobar-elegibilidad").firstMove, /tabla de requisitos/i);
});

test("el buscador de casos usa el contexto de titulación y los ejemplos ETSE-DIE", () => {
  assert.equal(searchSituationGuides(guides, "GIET cambiar examen")[0].id, "cambiar-horario-aula-examen");
  assert.equal(searchSituationGuides(guides, "MUIE TFM patentable")[0].id, "tfg-tfm-confidencial");
  assert.equal(searchSituationGuides(guides, "PDIE memristores depósito")[0].id, "seguimiento-deposito-tesis");
  assert.equal(searchSituationGuides(guides, "source-measure rangos interfaces accesorios")[0].id, "compra-desde-5000");
  assert.ok(searchSituationGuides(guides, "GDS receta petición").slice(0, 10).some((guide) => guide.id === "responder-peticion-datos-codigo"));
});

test("las situaciones generan entradas profundas para el buscador global", () => {
  const entries = situationSearchItems(guides);
  assert.equal(entries.length, 105);
  assert.ok(entries.every((entry) => /^example\.html\?caso=/.test(entry.href)));
  assert.ok(entries.every((entry) => entry.title && entry.category && entry.content.length > 100));
});
