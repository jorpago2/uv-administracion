import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { guideBelongsToArea } from "../area-model.js";
import { buildExampleGuides } from "../example-guide-model.js";
import { buildSituationGuides, combineSituationCatalogs } from "../situation-model.js";

const situations = JSON.parse(await readFile(new URL("../data/situations.json", import.meta.url), "utf8"));
const extension = JSON.parse(await readFile(new URL("../data/situations-51-100.json", import.meta.url), "utf8"));
const manual = JSON.parse(await readFile(new URL("../data/manual.json", import.meta.url), "utf8"));
const operations = JSON.parse(await readFile(new URL("../data/operations.json", import.meta.url), "utf8"));
const academic = JSON.parse(await readFile(new URL("../data/academic-situation-context.json", import.meta.url), "utf8"));
const personal = JSON.parse(await readFile(new URL("../data/personal-research-context.json", import.meta.url), "utf8"));
const guides = buildSituationGuides(combineSituationCatalogs(situations, extension), buildExampleGuides(manual.markdown, operations.procedures), academic, personal);

test("las seis áreas reparten las cien situaciones sin huecos ni duplicados", () => {
  const expectedCounts = { planificacion: 5, docencia: 21, pdi: 14, investigacion: 36, gestion: 17, cumplimiento: 7 };
  const memberships = new Map(guides.map((guide) => [guide.id, []]));
  for (const [areaId, expected] of Object.entries(expectedCounts)) {
    const areaGuides = guides.filter((guide) => guideBelongsToArea(guide, areaId));
    assert.equal(areaGuides.length, expected, areaId);
    areaGuides.forEach((guide) => memberships.get(guide.id).push(areaId));
  }
  for (const [id, areas] of memberships) assert.deepEqual(areas.length, 1, `${id}: ${areas.join(", ")}`);
});

test("POD se presenta en docencia y la carrera PDI conserva sus casos propios", () => {
  assert.equal(guideBelongsToArea(guides.find((guide) => guide.id === "corregir-pod-oca"), "docencia"), true);
  assert.equal(guideBelongsToArea(guides.find((guide) => guide.id === "preparar-acreditacion-aneca-avap"), "pdi"), true);
  assert.equal(guideBelongsToArea(guides.find((guide) => guide.id === "incorporacion-inicial"), "planificacion"), true);
});
