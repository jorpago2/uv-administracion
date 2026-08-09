import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(repositoryRoot, "web", "data");

const [manual, situationsA, situationsB, glossary, funding, operations, academicProgrammes, academicSituationContext, personalResearchContext, contentAudit] = await Promise.all([
  readJson("manual.json"), readJson("situations.json"), readJson("situations-51-100.json"),
  readJson("glossary.json"), readJson("funding-calls.json"), readJson("operations.json"), readJson("academic-programmes.json"),
  readJson("academic-situation-context.json"), readJson("personal-research-context.json"), readJson("content-audit.json")
]);
const academicContextBySituation = new Map(academicSituationContext.contexts.map((context) => [context.situationId, context]));
const personalContextBySituation = new Map(personalResearchContext.contexts.map((context) => [context.situationId, context]));

const entries = [
  ...manual.markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)
].map((match) => ({
  kind: `Capítulo ${match[1]}`,
  title: match[2].trim(),
  context: "Manual operativo",
  keywords: match[2],
  href: `manual/#${slugify(match[2])}`,
  priority: 2
}));

for (const situation of [...situationsA.situations, ...situationsB.situations]) {
  const academicContext = academicContextBySituation.get(situation.id);
  const personalContext = personalContextBySituation.get(situation.id);
  entries.push({
    kind: "Situación",
    title: situation.title,
    context: situation.scenario,
    keywords: [
      ...(situation.aliases ?? []), situation.guide?.unit, situation.guide?.channel,
      ...(academicContext?.programmeIds ?? []), academicContext?.authority, academicContext?.example,
      ...(academicContext?.differences ?? []), ...(personalContext?.stages ?? []), personalContext?.application,
      personalContext?.example, ...(personalContext?.resourceIds ?? [])
    ].filter(Boolean).join(" "),
    href: `example.html?caso=${encodeURIComponent(situation.id)}`,
    priority: 6
  });
}

for (const item of glossary.terms ?? glossary.items ?? []) {
  entries.push({
    kind: "Glosario",
    title: item.term,
    context: item.definition,
    keywords: [item.expanded, ...(item.aliases ?? [])].filter(Boolean).join(" "),
    href: `glosario/#termino-${item.id}`,
    priority: 3
  });
}

for (const call of funding.calls ?? []) {
  entries.push({
    kind: "Financiación",
    title: call.name ?? call.title,
    context: [call.levelLabel, call.purposeLabel, call.frequencyLabel].filter(Boolean).join(" · "),
    keywords: [call.acronym, call.level, call.purpose, call.profile, call.beneficiary].flat().filter(Boolean).join(" "),
    href: `financiacion/?q=${encodeURIComponent(call.acronym ?? call.name ?? call.title)}`,
    priority: 4
  });
}

for (const procedure of operations.procedures ?? []) {
  entries.push({
    kind: "Procedimiento",
    title: procedure.title,
    context: procedure.unit ?? procedure.summary ?? "Ficha operativa",
    keywords: [procedure.area, procedure.role, procedure.moment, ...(procedure.aliases ?? [])].filter(Boolean).join(" "),
    href: `herramientas/#fichas-procedimiento`,
    priority: 4
  });
}

for (const programme of academicProgrammes.programmes ?? []) {
  entries.push({
    kind: programme.scope === "investigacion" ? "Doctorado" : "Titulación",
    title: `${programme.acronym} · ${programme.name}`,
    context: `${programme.centre} · código UV ${programme.uvCode} · RUCT ${programme.ructId}`,
    keywords: [programme.levelLabel, programme.department, programme.governance, ...programme.documents.flatMap((document) => [document.typeLabel, document.title, document.purpose])].join(" "),
    href: `programas/#${programme.id}`,
    priority: 9
  });
  for (const document of programme.documents) {
    entries.push({
      kind: document.typeLabel,
      title: `${programme.acronym} · ${document.title}`,
      context: document.status,
      keywords: `${programme.name} ${programme.uvCode} ${programme.ructId} ${document.purpose}`,
      href: `programas/?programa=${encodeURIComponent(programme.acronym)}#${programme.id}`,
      priority: document.type === "verifica" ? 10 : 7
    });
  }
}

for (const gap of contentAudit.missingCases) {
  entries.push({
    kind: "Hueco detectado",
    title: gap.title,
    context: gap.reason,
    keywords: `${gap.priority} ${gap.nearbySituationIds.join(" ")}`,
    href: `auditoria/#gapsTitle`,
    priority: gap.priority === "alta" ? 9 : 6
  });
}

entries.push(
  route("Auditoría", contentAudit.title, "Cobertura, pertinencia, fuentes y casos pendientes", `${contentAudit.scope} control calidad casos genericos incompletos mapa institucional`, "auditoria/", 11),
  route("Perfil", personalResearchContext.title, "ICMUV · UMDO+ · ciclo completo de dispositivos", `${personalResearchContext.summary} ${personalResearchContext.themes.map((theme) => theme.label).join(" ")} ${personalResearchContext.stages.map((stage) => stage.label).join(" ")}`, "investigacion/#researchProfile", 11),
  route("Herramienta", "Comprar mediante SDA", "Suministros homologados, pedido y unidad gestora", "SDA lente thorlabs material laboratorio proveedor compra", "herramientas/#calculadora-compras", 10),
  route("Herramienta", "Calcular salario bruto", "Categoría, trienios, quinquenios, sexenios y complementos", "nomina retribucion sueldo salario", "herramientas/#calculadora-retributiva", 10),
  route("Herramienta", "Planificar viaje o congreso", "Autorización, inscripción, transporte, alojamiento, caja fija y reintegro", "dieta billete hotel congreso quien paga viaje", "herramientas/#calculadora-viajes", 10),
  route("Área", "Patentes y protección de resultados", "Investigación y transferencia", "invencion propiedad industrial secreto software divulgar", "investigacion/#capitulo-24", 10),
  route("Área", "Crear una spin-off", "Investigación y transferencia", "empresa derivada compatibilidad participacion", "investigacion/#capitulo-27", 10),
  route("Glosario", "Caja fija", "Anticipo, pago y justificación", "adelantar dinero efectivo reintegro", "glosario/?q=caja%20fija", 10)
);

entries.sort((left, right) => right.priority - left.priority || left.title.localeCompare(right.title, "es"));
await writeFile(path.join(dataDirectory, "site-search.json"), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
console.log(`Índice web generado: ${entries.length} entradas.`);

async function readJson(filename) {
  return JSON.parse(await readFile(path.join(dataDirectory, filename), "utf8"));
}

function route(kind, title, context, keywords, href, priority) {
  return { kind, title, context, keywords, href, priority };
}

function slugify(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
