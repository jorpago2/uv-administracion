import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const routes = [
  "index.html", "consulta.html", "example.html", "resolver/index.html", "administracion/index.html",
  "docencia/index.html", "carrera-pdi/index.html", "investigacion/index.html", "gestion/index.html",
  "cumplimiento/index.html", "financiacion/index.html", "herramientas/index.html", "glosario/index.html", "manual/index.html"
];
const viteConfig = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
const searchIndex = JSON.parse(await readFile(new URL("../data/site-search.json", import.meta.url), "utf8"));

test("Vite compila todas las rutas publicas", async () => {
  for (const route of routes) {
    await access(new URL(`../${route}`, import.meta.url));
    if (route !== "index.html" && route !== "example.html") assert.match(viteConfig, new RegExp(route.replace(/[./-]/g, "\\$&")));
  }
});

test("cada pagina fuente conserva identificadores unicos", async () => {
  for (const route of routes) {
    const html = await readFile(new URL(`../${route}`, import.meta.url), "utf8");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, route);
  }
});

test("el indice ligero solo genera destinos internos seguros", () => {
  assert.ok(searchIndex.length >= 200);
  for (const entry of searchIndex) {
    assert.ok(entry.title && entry.kind && entry.href, entry.title);
    assert.doesNotMatch(entry.href, /^(?:javascript|data|vbscript):/i, entry.title);
    const firstSegment = entry.href.split(/[/?#]/)[0];
    assert.ok(["example.html", "manual", "financiacion", "herramientas", "glosario", "investigacion"].includes(firstSegment), `${entry.title}: ${entry.href}`);
  }
});
