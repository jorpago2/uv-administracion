import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manualPath = path.join(repositoryRoot, "MANUAL_PROCEDIMIENTOS.md");
const markdown = await readFile(manualPath, "utf8");
const links = [...new Set([...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]))];
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
