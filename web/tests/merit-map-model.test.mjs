import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MERIT_PROFILE_DEFAULTS,
  assetLeverage,
  calculateMeritScenario,
  exportMeritMapMarkdown,
  filterAssets,
  validateMeritMapData
} from "../merit-map-model.js";

const data = JSON.parse(await readFile(new URL("../data/merit-map.json", import.meta.url), "utf8"));

test("el catálogo enlaza sistemas, convocatorias afines y fuentes existentes", () => {
  assert.equal(validateMeritMapData(data), true);
  assert.ok(data.tailoredCalls.length >= 7);
  assert.ok(data.tailoredCalls.some((call) => call.code === "HORIZON-CL4-2027-05-DIGITAL-EMERGING-03"));
  assert.ok(data.tailoredCalls.some((call) => call.code === "HORIZON-Chips-JU-2026-FT2-IA"));
});

test("el punto de partida personal no inventa méritos todavía no maduros", () => {
  const scenario = calculateMeritScenario(MERIT_PROFILE_DEFAULTS);
  assert.equal(scenario.blocks.find((block) => block.id === "research").subtotal, 10);
  assert.equal(scenario.blocks.find((block) => block.id === "teaching").subtotal, 0);
  assert.equal(scenario.blocks.find((block) => block.id === "leadership").subtotal, 0);
  assert.match(scenario.blocks.find((block) => block.id === "leadership").minimumStatus, /pendiente/);
});

test("una tesis individual o dos codirecciones cubren orientativamente el mínimo 3.2", () => {
  const individual = calculateMeritScenario({ ...MERIT_PROFILE_DEFAULTS, individualTheses: 1 });
  const shared = calculateMeritScenario({ ...MERIT_PROFILE_DEFAULTS, coDirectedTheses: 2 });
  assert.match(individual.blocks.find((block) => block.id === "leadership").minimumStatus, /alcanzado/);
  assert.equal(shared.blocks.find((block) => block.id === "leadership").components.find((item) => item.label === "Tesis y TFM defendidos").points, 10);
});

test("el mismo proyecto IP se asigna a investigación o liderazgo, nunca a ambos", () => {
  const research = calculateMeritScenario({ ...MERIT_PROFILE_DEFAULTS, stateIpYears: 4, ipAllocation: "research" });
  const leadership = calculateMeritScenario({ ...MERIT_PROFILE_DEFAULTS, stateIpYears: 4, ipAllocation: "leadership" });
  assert.ok(research.blocks.find((block) => block.id === "research").components.some((item) => item.label === "Proyecto estatal como IP"));
  assert.ok(!research.blocks.find((block) => block.id === "leadership").components.some((item) => item.label === "Dirección de equipos"));
  assert.ok(!leadership.blocks.find((block) => block.id === "research").components.some((item) => item.label === "Proyecto estatal como IP"));
  assert.ok(leadership.blocks.find((block) => block.id === "leadership").components.some((item) => item.label === "Dirección de equipos"));
});

test("los filtros y la palanca operan sobre relaciones documentadas", () => {
  const visible = filterAssets(data.assets, { system: "erc", domain: "investigacion", query: "resultado" });
  assert.ok(visible.length >= 1);
  assert.ok(visible.every((asset) => asset.domain === "investigacion" && asset.systems.erc));
  assert.equal(assetLeverage(data.assets.find((asset) => asset.id === "competitive-ip")), 7);
});

test("la exportación conserva límites, lectura CU y fuentes", () => {
  const scenario = calculateMeritScenario(MERIT_PROFILE_DEFAULTS);
  const markdown = exportMeritMapMarkdown(scenario, data, new Date("2026-08-10T12:00:00+02:00"));
  assert.match(markdown, /Herramienta personal y no oficial/);
  assert.match(markdown, /## Lectura ANECA CU/);
  assert.match(markdown, /## Fuentes/);
});
