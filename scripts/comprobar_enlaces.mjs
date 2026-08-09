import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { buildExampleGuides } from "../web/example-guide-model.js";
import { buildSituationGuides, combineSituationCatalogs } from "../web/situation-model.js";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manualPath = path.join(repositoryRoot, "MANUAL_PROCEDIMIENTOS.md");
const operationsPath = path.join(repositoryRoot, "web", "data", "operations.json");
const decisionCasesPath = path.join(repositoryRoot, "web", "data", "decision-cases.json");
const situationsPath = path.join(repositoryRoot, "web", "data", "situations.json");
const situationsExtensionPath = path.join(repositoryRoot, "web", "data", "situations-51-100.json");
const travelPath = path.join(repositoryRoot, "web", "data", "travel-2026.json");
const academicProgrammesPath = path.join(repositoryRoot, "web", "data", "academic-programmes.json");
const personalResearchPath = path.join(repositoryRoot, "web", "data", "personal-research-context.json");
const webIndexPath = path.join(repositoryRoot, "web", "index.html");
const markdown = await readFile(manualPath, "utf8");
const operations = JSON.parse(await readFile(operationsPath, "utf8"));
const decisionCases = JSON.parse(await readFile(decisionCasesPath, "utf8"));
const situations = JSON.parse(await readFile(situationsPath, "utf8"));
const situationsExtension = JSON.parse(await readFile(situationsExtensionPath, "utf8"));
const travel = JSON.parse(await readFile(travelPath, "utf8"));
const academicProgrammes = JSON.parse(await readFile(academicProgrammesPath, "utf8"));
const personalResearch = JSON.parse(await readFile(personalResearchPath, "utf8"));
const webIndex = await readFile(webIndexPath, "utf8");
const markdownLinks = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
const procedureLinks = Array.isArray(operations.procedures) ? operations.procedures.map((procedure) => procedure.sourceUrl) : [];
const caseLinks = Array.isArray(decisionCases.cases) ? decisionCases.cases.map((item) => item.sourceUrl) : [];
const guideLinks = buildExampleGuides(markdown, operations.procedures).flatMap((guide) => guide.sources.map((source) => source.url));
const situationCatalog = combineSituationCatalogs(situations, situationsExtension);
const situationLinks = buildSituationGuides(situationCatalog, buildExampleGuides(markdown, operations.procedures)).flatMap((guide) => guide.sources.map((source) => source.url));
const webExternalLinks = [...webIndex.matchAll(/<a\s[^>]*href="(https?:\/\/[^"#]+(?:#[^"]*)?)"/gi)].map((match) => match[1].replace(/&amp;/g, "&"));
const academicLinks = [
  ...(academicProgrammes.structures ?? []).map((structure) => structure.url),
  ...(academicProgrammes.programmes ?? []).flatMap((programme) => programme.documents.map((document) => document.url))
];
const personalResearchLinks = (personalResearch.resources ?? []).map((resource) => resource.url);
const links = [...new Set([...markdownLinks, ...procedureLinks, ...caseLinks, ...guideLinks, ...situationLinks, travel.source, ...academicLinks, ...personalResearchLinks, ...webExternalLinks])];
const externalLinks = links.filter((link) => /^https?:\/\//i.test(link));
const localLinks = links.filter((link) => !/^[a-z][a-z0-9+.-]*:/i.test(link));

const localFailures = [];
for (const link of localLinks) {
  const localPath = path.resolve(repositoryRoot, decodeURIComponent(link.split("#", 1)[0]));
  try {
    await access(localPath);
  } catch {
    localFailures.push(link);
  }
}

const results = await mapConcurrent(externalLinks, 10, checkExternalLink);
const broken = results.filter(({ status }) => status === 404 || status === 410);
const warnings = results.filter(({ status }) => status === 0 || (status >= 400 && status !== 404 && status !== 410));

console.log(`Enlaces únicos: ${links.length} · externos: ${externalLinks.length} · locales: ${localLinks.length}`);
for (const link of localFailures) console.error(`LOCAL AUSENTE  ${link}`);
for (const { status, url, detail } of broken) console.error(`${status}  ${url}${detail ? ` · ${detail}` : ""}`);
for (const { status, url, detail } of warnings) console.warn(`AVISO ${status || "TIMEOUT"}  ${url}${detail ? ` · ${detail}` : ""}`);

if (localFailures.length || broken.length) process.exitCode = 1;
else console.log(`Comprobación superada${warnings.length ? ` con ${warnings.length} avisos de acceso automatizado` : ""}.`);

async function checkExternalLink(url) {
  const requestOptions = {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: { "user-agent": "Mozilla/5.0 enlace-check uv-administracion" }
  };
  try {
    let response = await fetch(url, { ...requestOptions, method: "HEAD" });
    if ([403, 405, 501].includes(response.status)) {
      response = await fetch(url, { ...requestOptions, method: "GET", headers: { ...requestOptions.headers, range: "bytes=0-0" } });
      await response.body?.cancel();
    }
    return { url, status: response.status, detail: response.url === url ? "" : `redirige a ${response.url}` };
  } catch (error) {
    return { url, status: 0, detail: error.name };
  }
}

async function mapConcurrent(items, concurrency, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return output;
}
