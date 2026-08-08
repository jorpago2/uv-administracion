import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectBudgetMarkdown, calculateProjectBudget } from "../project-budget-model.js";

test("calcula personal, IVA elegible, indirectos, reserva y anualidades", () => {
  const result = calculateProjectBudget(baseScenario());
  assert.equal(result.directEconomicCost, 146954);
  assert.equal(result.eligibleDirectCost, 146954);
  assert.equal(result.indirectCosts, 36738.5);
  assert.equal(result.economicBudget, 183692.5);
  assert.equal(result.reserve, 5510.78);
  assert.equal(result.plannedRequirement, 189203.28);
  assert.equal(result.requestedFunding, 183692.5);
  assert.equal(result.ownContribution, 5510.78);
  assert.deepEqual(result.annualities.map((item) => item.requestedFunding), [55107.75, 73477, 55107.75]);
});

test("distingue IVA recuperable e IVA no elegible", () => {
  const result = calculateProjectBudget({
    ...baseScenario(), personnel: [], indirectRate: 0, reserveRate: 0,
    directItems: [
      direct("Equipo con IVA recuperable", 1000, "recoverable"),
      direct("Equipo con IVA no elegible", 1000, "not-eligible")
    ]
  });
  assert.equal(result.directCashOutlay, 2420);
  assert.equal(result.directEconomicCost, 2210);
  assert.equal(result.eligibleDirectCost, 2000);
  assert.equal(result.recoverableVat, 210);
  assert.equal(result.ownContribution, 210);
});

test("aplica cofinanciación y límite máximo de ayuda", () => {
  const result = calculateProjectBudget({ ...baseScenario(), fundingRate: 80, grantCeiling: 100000 });
  assert.equal(result.requestedBeforeCeiling, 146954);
  assert.equal(result.requestedFunding, 100000);
  assert.equal(result.overCeiling, 46954);
  assert.equal(result.ownContribution, 89203.28);
});

test("rechaza anualidades que no suman cien y personal fuera del proyecto", () => {
  assert.throws(() => calculateProjectBudget({ ...baseScenario(), annualityPercentages: [30, 30, 30] }), /suman 90/);
  const scenario = baseScenario();
  scenario.personnel[0].months = 40;
  assert.throws(() => calculateProjectBudget(scenario), /supera las 3 anualidad/);
});

test("exporta un presupuesto Markdown auditable", () => {
  const markdown = buildProjectBudgetMarkdown("Sensor fotónico", calculateProjectBudget(baseScenario()));
  assert.match(markdown, /^# Presupuesto · Sensor fotónico/m);
  assert.match(markdown, /Financiación solicitada \| 183\.692,5 €/);
  assert.match(markdown, /## Anualidades/);
});

function baseScenario() {
  return {
    years: 3,
    fundingRate: 100,
    indirectRate: 25,
    reserveRate: 3,
    grantCeiling: 200000,
    annualityPercentages: [30, 40, 30],
    personnel: [{
      id: "p1", label: "Personal investigador", grossAnnual: 32000, months: 24,
      contractType: "fixed", accidentRate: 1.5, otherRate: 0, otherCosts: 0,
      eligibilityPercent: 100, indirectBase: true
    }],
    directItems: [
      direct("Equipamiento", 25000, "eligible", "equipment"),
      direct("Fungible", 10000, "eligible", "consumables"),
      { ...direct("Viajes", 12000, "eligible", "travel"), vatRate: 0 },
      direct("Otros", 6000, "eligible", "other")
    ]
  };
}

function direct(label, netAmount, vatTreatment, category = "equipment") {
  return { label, category, netAmount, vatRate: 21, vatTreatment, eligibilityPercent: 100, indirectBase: true };
}
