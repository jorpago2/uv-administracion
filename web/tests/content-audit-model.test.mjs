import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildContentAudit, filterContentAudit, summarizeContentAudit } from "../content-audit-model.js";

const config = JSON.parse(await readFile(new URL("../data/content-audit.json", import.meta.url), "utf8"));
const catalogA = JSON.parse(await readFile(new URL("../data/situations.json", import.meta.url), "utf8"));
const catalogB = JSON.parse(await readFile(new URL("../data/situations-51-100.json", import.meta.url), "utf8"));
const catalogC = JSON.parse(await readFile(new URL("../data/situations-101-104.json", import.meta.url), "utf8"));
const rawSituations = [...catalogA.situations, ...catalogB.situations, ...catalogC.situations];

function guide(raw, overrides = {}) {
  return {
    id: raw.id,
    situationNumber: raw.number,
    title: raw.title,
    scenario: raw.scenario,
    categoryId: raw.category,
    categoryLabel: raw.category,
    sources: [{ label: "A", url: "https://www.uv.es" }, { label: "B", url: "https://www.boe.es" }],
    steps: ["1", "2", "3", "4", "5"],
    documents: ["1", "2", "3"],
    completionEvidence: ["1", "2", "3"],
    academicContext: null,
    personalResearchContext: null,
    ...overrides
  };
}

test("la auditoría clasifica los 104 casos una sola vez", () => {
  const academicId = "preparar-guia-docente";
  const researchId = "presupuesto-proyecto";
  const guides = rawSituations.map((raw) => guide(raw, {
    academicContext: raw.id === academicId ? {} : null,
    personalResearchContext: raw.id === researchId ? { fit: "direct" } : null,
    sources: config.reinforceSituationIds.includes(raw.id) ? [{ label: "A", url: "https://www.uv.es" }] : guide(raw).sources
  }));
  const audit = buildContentAudit(guides, rawSituations, config);
  const summary = summarizeContentAudit(audit, config);
  assert.equal(audit.length, 104);
  assert.equal(new Set(audit.map((item) => item.id)).size, 104);
  assert.equal(Object.values(summary.counts).reduce((sum, value) => sum + value, 0), 104);
  assert.equal(summary.counts.reinforce, config.reinforceSituationIds.length);
  assert.equal(summary.counts.low, config.lowRelevanceSituationIds.length);
  assert.equal(summary.missing, config.missingCases.length);
});

test("los estados explícitos prevalecen sobre el contexto heredado", () => {
  const rawReinforce = rawSituations.find((item) => item.id === config.reinforceSituationIds[0]);
  const rawLow = rawSituations.find((item) => item.id === config.lowRelevanceSituationIds[0]);
  const guides = [
    guide(rawReinforce, { academicContext: {}, sources: [{ label: "A", url: "https://www.uv.es" }] }),
    guide(rawLow, { personalResearchContext: { fit: "conditional" } })
  ];
  const localConfig = { ...config, highPrioritySituationIds: config.highPrioritySituationIds.filter((id) => guides.some((item) => item.id === id)), reinforceSituationIds: [rawReinforce.id], lowRelevanceSituationIds: [rawLow.id] };
  const audit = buildContentAudit(guides, [rawReinforce, rawLow], localConfig);
  assert.equal(audit.find((item) => item.id === rawReinforce.id).statusId, "reinforce");
  assert.equal(audit.find((item) => item.id === rawLow.id).statusId, "low");
});

test("los filtros combinan texto, estado, ámbito y prioridad", () => {
  const raw = rawSituations.find((item) => item.id === "crear-spin-off");
  const localConfig = { ...config, reinforceSituationIds: [raw.id], lowRelevanceSituationIds: [], highPrioritySituationIds: [raw.id] };
  const audit = buildContentAudit([guide(raw, { sources: [{ label: "A", url: "https://www.uv.es" }] })], [raw], localConfig);
  assert.equal(filterContentAudit(audit, { query: "spin off", status: "reinforce", category: "investigacion", priority: "alta" }).length, 1);
  assert.equal(filterContentAudit(audit, { query: "nómina" }).length, 0);
});
