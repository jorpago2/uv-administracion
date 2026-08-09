import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROFILE_DEFAULTS, buildCareerAssessment, evaluateOpportunity, exportCareerRoadmapMarkdown } from "../career-roadmap-model.js";

const data = JSON.parse(await readFile(new URL("../data/career-roadmap.json", import.meta.url), "utf8"));
const asOf = new Date("2026-08-10T12:00:00+02:00");

test("los nuevos datos sitúan el plan después de la acreditación PTU", () => {
  const result = buildCareerAssessment(PROFILE_DEFAULTS, data, asOf);
  assert.equal(result.stage, "post-ptu");
  assert.equal(result.gates.find((gate) => gate.id === "accreditation").status, "ready");
  assert.equal(result.gates.find((gate) => gate.id === "c1").status, "ready");
  assert.equal(result.gates.find((gate) => gate.id === "emerging-project").status, "ready");
  assert.equal(result.profile.sexennia, 1);
  assert.equal(result.profile.teaching, "quinquennium");
  assert.equal(result.profile.accreditationNotified, "yes");
  assert.equal(result.gates.find((gate) => gate.id === "contract").status, "future");
  assert.equal(result.priorities[0].id, "launch-ge-project");
  assert.ok(result.priorities.some((item) => item.id === "track-promotion-cycle"));
  assert.match(result.headline, /promoción/);
});

test("un expediente no resuelto conserva la distinción entre indicios y evidencia", () => {
  const result = buildCareerAssessment({ ...PROFILE_DEFAULTS, accreditation: "not-started", accreditationNotified: "no", c1: "unknown", teaching: "likely", research: "portfolio", sexennia: 0, emergingProject: "none", projectRole: "member" }, data, asOf);
  assert.equal(result.stage, "document-ptu");
  assert.equal(result.gates.find((gate) => gate.id === "mobility").status, "evidence");
  assert.equal(result.gates.find((gate) => gate.id === "teaching").status, "evidence");
  assert.equal(result.gates.find((gate) => gate.id === "research").status, "evidence");
});

test("un sexenio reconocido marca el mínimo investigador sin prometer la acreditación completa", () => {
  const result = buildCareerAssessment({ ...PROFILE_DEFAULTS, accreditation: "not-started", research: "sexennium", sexennia: 1 }, data, asOf);
  assert.equal(result.gates.find((gate) => gate.id === "research").status, "ready");
  assert.match(result.warnings[0], /no calcula ni predice/);
});

test("la fecha de contrato activa una alerta cuando queda poco margen", () => {
  const result = buildCareerAssessment({ ...PROFILE_DEFAULTS, contractEnd: "2027-06-30" }, data, asOf);
  const contract = result.gates.find((gate) => gate.id === "contract");
  assert.equal(contract.status, "gap");
  assert.match(contract.next, /meses/);
});

test("el presupuesto semanal conserva exactamente las horas disponibles", () => {
  const result = buildCareerAssessment({ ...PROFILE_DEFAULTS, weeklyHours: 7.5 }, data, asOf);
  const total = result.weeklyAllocation.reduce((sum, item) => sum + item.hours, 0);
  assert.ok(Math.abs(total - 7.5) < 1e-9);
});

test("el filtro de oportunidades penaliza carga recurrente y desplazamiento", () => {
  const strategic = evaluateOpportunity({ gate: true, reusable: true, concreteOutput: true, hours: 4 });
  const distracting = evaluateOpportunity({ hours: 60, displacesCore: true, recurring: true });
  assert.equal(strategic.verdict, "prioritize");
  assert.equal(distracting.verdict, "decline");
  assert.ok(strategic.score > distracting.score);
});

test("la exportación Markdown incluye límites, puertas, ruta y fuentes", () => {
  const result = buildCareerAssessment(PROFILE_DEFAULTS, data, asOf);
  const markdown = exportCareerRoadmapMarkdown(result, data, asOf);
  assert.match(markdown, /no garantiza acreditación ni plaza/i);
  assert.match(markdown, /## Puertas de paso/);
  assert.match(markdown, /## Hoja de ruta/);
  assert.match(markdown, /## Fuentes/);
});
