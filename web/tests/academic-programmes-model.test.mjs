import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { filterAcademicProgrammes, validateAcademicProgrammes } from "../academic-programmes-model.js";

const data = JSON.parse(await readFile(new URL("../data/academic-programmes.json", import.meta.url), "utf8"));
const catalogue = validateAcademicProgrammes(data);

test("el catálogo cubre los cuatro programas docentes y el doctorado", () => {
  assert.deepEqual(catalogue.programmes.map((programme) => programme.acronym), ["GIET", "GIEI", "GIT", "MUIE", "PDIE"]);
  assert.equal(catalogue.programmes.filter((programme) => programme.scope === "docencia").length, 4);
  assert.equal(catalogue.programmes.filter((programme) => programme.scope === "investigacion").length, 1);
});

test("cada programa enlaza ficha, memoria, plan y calidad en fuentes oficiales", () => {
  for (const programme of catalogue.programmes) {
    assert.deepEqual(new Set(programme.documents.map((document) => document.type)), new Set(["ficha", "verifica", "plan", "seguimiento"]), programme.id);
    for (const document of programme.documents) {
      const hostname = new URL(document.url).hostname;
      assert.ok(hostname === "www.uv.es" || hostname.endsWith(".uv.es"), `${programme.id}: ${hostname}`);
    }
  }
});

test("los filtros localizan acrónimos y familias documentales", () => {
  const master = filterAcademicProgrammes(catalogue.programmes, { query: "MUIE", documentType: "verifica" });
  assert.equal(master.length, 1);
  assert.equal(master[0].documents.length, 1);
  assert.equal(master[0].documents[0].type, "verifica");
  const doctorate = filterAcademicProgrammes(catalogue.programmes, { scope: "investigacion" });
  assert.deepEqual(doctorate.map((programme) => programme.id), ["die-doctorado"]);
});
