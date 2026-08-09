import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { CHAPTER_ANCHORS } from "../web/chapter-links.js";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptsDirectory, "..");
const sourcePath = join(repositoryRoot, "web", "data", "glossary.json");
const outputPaths = [
  join(repositoryRoot, "GLOSARIO_PDI.md"),
  join(repositoryRoot, "web", "public", "GLOSARIO_PDI.md")
];

const glossary = JSON.parse(await readFile(sourcePath, "utf8"));
validateGlossary(glossary);

const lines = [
  "---",
  'title: "Glosario operativo para PDI de nueva incorporación en la UV"',
  `fecha_revision: "${glossary.meta.reviewed}"`,
  `terminos: "${glossary.terms.length}"`,
  "---",
  "",
  "# Glosario operativo para PDI de nueva incorporación en la UV",
  "",
  "Este glosario está pensado para el uso personal de [Jorge Parra](https://www.uv.es/jorpago2). Resume vocabulario frecuente de docencia, investigación y gestión en lenguaje directo. No es una instrucción, recomendación ni interpretación oficial; puede contener errores o quedar desactualizado. Antes de actuar, comprueba la fuente enlazada y consulta a la unidad competente si el asunto tiene plazo, coste o efectos jurídicos.",
  "",
  "## Cómo utilizarlo",
  "",
  "Cada entrada distingue cuatro niveles: qué significa, cómo aparece en la práctica, con qué no debe confundirse y dónde verificarla. Los enlaces a capítulos conducen al [manual operativo](MANUAL_PROCEDIMIENTOS.md). La versión web permite buscar también por siglas, sinónimos y texto de las fichas.",
  ""
];

for (const category of glossary.categories) {
  lines.push(`## ${category.label}`, "");
  const terms = glossary.terms
    .filter((item) => item.category === category.id)
    .sort((left, right) => left.term.localeCompare(right.term, "es"));
  for (const item of terms) {
    const title = item.expanded ? `${item.term} — ${item.expanded}` : item.term;
    lines.push(
      `### ${title}`,
      "",
      `**Qué significa.** ${item.definition}`,
      "",
      `**En la práctica.** ${item.practical}`,
      "",
      `**No lo confundas.** ${item.caution}`,
      ""
    );
    if (item.aliases?.length) lines.push(`**También puedes encontrarlo como:** ${item.aliases.join(", ")}.`, "");
    const sourceLinks = item.sourceIds.map((sourceId) => {
      const source = glossary.sources[sourceId];
      return `[${source.label}](${source.url})`;
    });
    lines.push(`**Fuentes oficiales:** ${sourceLinks.join("; ")}.`, "");
    if (item.chapters?.length) {
      const chapterLinks = item.chapters.map((number) => `[cap. ${number}](MANUAL_PROCEDIMIENTOS.md#${CHAPTER_ANCHORS[number]})`);
      lines.push(`**En esta guía:** ${chapterLinks.join(", ")}.`, "");
    }
  }
}

const markdown = `${lines.join("\n").trim()}\n`;
await Promise.all(outputPaths.map((outputPath) => writeFile(outputPath, markdown, "utf8")));
console.log(`Glosario generado: ${glossary.terms.length} términos en ${outputPaths.length} destinos.`);

function validateGlossary(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.categories) || !Array.isArray(data.terms) || !data.sources) {
    throw new TypeError("El glosario no tiene el formato esperado.");
  }
  const categories = new Set(data.categories.map((item) => item.id));
  const ids = new Set();
  for (const item of data.terms) {
    if (!item.id || ids.has(item.id)) throw new Error(`Identificador inválido o duplicado: ${item.id ?? "vacío"}.`);
    ids.add(item.id);
    if (!categories.has(item.category) || !item.term || !item.definition || !item.practical || !item.caution) {
      throw new Error(`Entrada incompleta: ${item.id}.`);
    }
    if (!item.sourceIds?.length || item.sourceIds.some((sourceId) => !data.sources[sourceId])) throw new Error(`Fuentes inválidas: ${item.id}.`);
    if (item.chapters?.some((number) => !CHAPTER_ANCHORS[number])) throw new Error(`Capítulo inválido: ${item.id}.`);
  }
}
