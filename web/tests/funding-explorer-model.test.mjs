import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildComparisonRows,
  filterFundingCalls,
  getTraceabilityStatus,
  updateComparison,
  validateFundingData
} from "../funding-explorer-model.js";

const funding = JSON.parse(await readFile(new URL("../data/funding-calls.json", import.meta.url), "utf8"));

test("valida 35 vías de financiación trazables", () => {
  const validated = validateFundingData(funding);
  assert.equal(validated.calls.length, 35);
  assert.deepEqual(new Set(validated.calls.map((call) => call.level)), new Set(["european", "state", "regional", "uv", "private"]));
  for (const call of validated.calls) {
    assert.match(call.source.url, /^https:\/\//);
    assert.match(call.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(call.editionReference.length > 0);
  }
});

test("combina filtros de nivel, finalidad, beneficiario y TRL", () => {
  const results = filterFundingCalls(funding.calls, {
    level: "european",
    purpose: "transfer",
    beneficiary: "university",
    trl: "5"
  });
  assert.deepEqual(results.map((call) => call.id).sort(), ["eic-transition", "erc-proof-concept"]);
});

test("filtra perfiles y distingue empresa beneficiaria", () => {
  const excellent = filterFundingCalls(funding.calls, { profile: "excellent-group" });
  assert.ok(excellent.some((call) => call.id === "gva-prometeo"));
  assert.ok(!excellent.some((call) => call.id === "gva-ge"));

  const companies = filterFundingCalls(funding.calls, { level: "state", beneficiary: "company" });
  assert.ok(companies.some((call) => call.id === "cdti-id"));
  assert.ok(companies.every((call) => call.beneficiaries.includes("company")));
});

test("el buscador ignora mayúsculas y acentos", () => {
  const results = filterFundingCalls(funding.calls, { query: "CAPTACION EUROPEOS" });
  assert.ok(results.some((call) => call.id === "gva-ape"));
});

test("limita la comparación a tres convocatorias y permite retirarlas", () => {
  let selected = [];
  for (const id of ["aei-pid", "eic-pathfinder", "gva-prometeo"]) selected = updateComparison(selected, id).selection;
  const blocked = updateComparison(selected, "erc-starting");
  assert.equal(blocked.changed, false);
  assert.equal(blocked.reason, "limit");
  assert.deepEqual(blocked.selection, selected);
  const removed = updateComparison(selected, "aei-pid");
  assert.equal(removed.reason, "removed");
  assert.deepEqual(removed.selection, ["eic-pathfinder", "gva-prometeo"]);
});

test("genera las filas comparables y evalúa vigencia de la verificación", () => {
  const calls = funding.calls.filter((call) => ["aei-pid", "eic-pathfinder"].includes(call.id));
  const rows = buildComparisonRows(calls);
  assert.ok(rows.some((row) => row.label === "Financiación"));
  assert.ok(rows.every((row) => row.values.length === 2));
  assert.equal(getTraceabilityStatus(calls[0], new Date("2026-08-09T12:00:00Z")).id, "current");
  assert.equal(getTraceabilityStatus({ ...calls[0], verifiedOn: "2025-01-01" }, new Date("2026-08-09T12:00:00Z")).id, "stale");
});

test("rechaza fechas imposibles y fuentes no seguras", () => {
  const invalidDate = structuredClone(funding);
  invalidDate.calls[0].verifiedOn = "2026-02-31";
  assert.throws(() => validateFundingData(invalidDate), /Fecha de verificación/);

  const invalidSource = structuredClone(funding);
  invalidSource.calls[0].source.url = "http://example.org";
  assert.throws(() => validateFundingData(invalidSource), /Fuente no válida/);
});
