import { EXAMPLE_GUIDANCE, EXTRA_OFFICIAL_SOURCES } from "./example-guidance.js";
import { EXAMPLE_TRANSFERABILITY } from "./example-transferability.js";

const DEFAULT_DOCUMENTS = Object.freeze([
  "Norma, convocatoria o instrucción vigente aplicable al caso",
  "Evidencias de los hechos, fechas y personas o unidades implicadas",
  "Borrador de la solicitud, memoria o comunicación antes de firmarla",
  "Justificante de registro y copia exacta de todo lo presentado"
]);

export function buildExampleGuides(markdown, procedures) {
  if (typeof markdown !== "string" || !Array.isArray(procedures)) throw new TypeError("El manual o las fichas no tienen el formato esperado.");
  const chapters = splitChapters(markdown);
  return chapters.flatMap((chapter) => {
    const example = extractExample(chapter.body);
    if (!example) return [];
    const guidance = EXAMPLE_GUIDANCE[chapter.number];
    if (!guidance) throw new Error(`Falta orientación experta para el ejemplo del capítulo ${chapter.number}.`);
    const transferability = EXAMPLE_TRANSFERABILITY[chapter.number];
    if (!transferability) throw new Error(`Falta definir la transferibilidad del ejemplo del capítulo ${chapter.number}.`);
    const matchingProcedures = procedures.filter((procedure) => procedure.chapter === chapter.number);
    const documents = unique([
      ...matchingProcedures.flatMap((procedure) => procedure.documents ?? []),
      ...DEFAULT_DOCUMENTS
    ]).slice(0, 10);
    const proceduralSteps = unique(matchingProcedures.flatMap((procedure) => procedure.steps ?? []));
    const chapterSteps = extractNumberedSteps(chapter.body);
    const steps = unique(proceduralSteps.length ? proceduralSteps : chapterSteps).slice(0, 10);
    const sources = collectSources(chapter, matchingProcedures);

    return [{
      id: slugify(example.title),
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      chapterSlug: slugify(chapter.title),
      title: sentenceCase(example.title),
      scenario: stripMarkdown(example.scenario),
      outcome: guidance.outcome,
      firstMove: guidance.firstMove,
      questions: [...guidance.questions],
      successChecks: [...guidance.successChecks],
      alsoApplies: transferability.alsoApplies,
      adapt: transferability.adapt,
      stopsApplying: transferability.stopsApplying,
      unit: guidance.unit || unique(matchingProcedures.map((procedure) => procedure.unit)).join(" · ") || "Unidad competente indicada por la norma o convocatoria",
      channel: unique(matchingProcedures.map((procedure) => procedure.channel)).join(" · ") || "Consulta previa y, cuando proceda, Sede Electrónica UV",
      deadline: unique(matchingProcedures.map((procedure) => procedure.deadline)).join(" · ") || "Antes de actuar y dentro del plazo de la norma, convocatoria o calendario vigente",
      documents,
      steps: steps.length ? steps : fallbackSteps(guidance.firstMove),
      risks: unique([
        ...matchingProcedures.map((procedure) => procedure.risk),
        "Empezar la actividad o asumir compromisos antes de obtener las autorizaciones necesarias.",
        "Confiar en una conversación o correo cuando el procedimiento exige registro o resolución."
      ]).filter(Boolean).slice(0, 6),
      sources,
      procedureTitles: matchingProcedures.map((procedure) => procedure.title)
    }];
  });
}

export function findExampleGuide(guides, chapterNumber) {
  const number = Number(chapterNumber);
  return Number.isInteger(number) ? guides.find((guide) => guide.chapterNumber === number) ?? null : null;
}

export function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitChapters(markdown) {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  const matches = [...normalized.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    title: match[2].trim(),
    body: normalized.slice(match.index + match[0].length, index + 1 < matches.length ? matches[index + 1].index : normalized.length).trim()
  }));
}

function extractExample(body) {
  const match = body.match(/^>\s+\*\*Ejemplo realista\s*[—-]\s*(.+?)\.\*\*\s+(.+)$/m);
  return match ? { title: match[1].trim(), scenario: match[2].trim() } : null;
}

function extractNumberedSteps(body) {
  return [...body.matchAll(/^\d+\.\s+(.+)$/gm)].map((match) => stripMarkdown(match[1]));
}

function collectSources(chapter, procedures) {
  const procedureSources = procedures
    .filter((procedure) => /^https:\/\//i.test(procedure.sourceUrl ?? ""))
    .map((procedure) => ({ label: procedure.sourceLabel || procedure.title, url: procedure.sourceUrl }));
  const extras = EXTRA_OFFICIAL_SOURCES[chapter.number] ?? [];
  const chapterSources = [...chapter.body.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+)\)/g)]
    .map((match) => ({ label: stripMarkdown(match[1]), url: match[2] }));
  const seen = new Set();
  return [...procedureSources, ...extras, ...chapterSources]
    .filter((source) => {
      const key = source.url.replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function fallbackSteps(firstMove) {
  return [
    firstMove,
    "Confirma por escrito unidad competente, canal, documentos y plazo.",
    "Prepara una versión completa y revísala contra la fuente oficial.",
    "Presenta por el cauce requerido y conserva el justificante.",
    "Haz seguimiento hasta obtener resolución, conformidad o cierre documentado."
  ];
}

function stripMarkdown(value) {
  return String(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value) {
  const text = String(value).trim();
  return text ? `${text[0].toLocaleUpperCase("es")}${text.slice(1)}` : text;
}

function unique(values) { return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))]; }
