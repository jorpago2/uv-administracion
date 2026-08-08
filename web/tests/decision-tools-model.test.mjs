import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculatePod, calculateTravel, classifyPurchase, estimatePersonnelCost, validateTravelData } from "../decision-tools-model.js";

const travelData = JSON.parse(await readFile(new URL("../data/travel-2026.json", import.meta.url), "utf8"));

test("aplica la transición POD de tres sexenios y el mínimo general", () => {
  const result = calculatePod({
    category: "permanent", course: "2027-28", sexennia: 3, active: true, inactiveYears: 0,
    publicProjects: 2, exceptionalEuropean: false, erasmusProjects: 0, thesisHours: 30, age63: false, otherHours: 0
  });
  assert.equal(result.baseline, 170);
  assert.equal(result.requestedReduction, 50);
  assert.equal(result.finalHours, 120);
});

test("retira el efecto de un sexenio inactivo después de seis cursos", () => {
  const result = calculatePod({ category: "cu", course: "2029-30", sexennia: 4, active: false, inactiveYears: 6 });
  assert.equal(result.baseline, 230);
});

test("distingue límite estricto general y límite inclusivo de investigación", () => {
  const general = classifyPurchase({ type: "supplies", amount: 15000, durationMonths: 3 });
  const research = classifyPurchase({ type: "research", amount: 50000, durationMonths: 3 });
  assert.equal(general.status, "not-minor");
  assert.equal(research.status, "minor");
  assert.equal(research.offers, 3);
});

test("exige tres ofertas para un suministro de investigación de 18.000 euros", () => {
  const result = classifyPurchase({ type: "research", amount: 18000, durationMonths: 4 });
  assert.equal(result.status, "minor");
  assert.equal(result.offers, 3);
  assert.equal(result.requiresAd, true);
});

test("no afirma el contrato menor de una suscripción sin verificar el umbral SARA", () => {
  const result = classifyPurchase({ type: "database", amount: 35000, durationMonths: 12 });
  assert.equal(result.status, "verify-threshold");
  assert.equal(result.offers, 3);
  assert.match(result.title, /SARA/);
});

test("calcula el caso de viaje a Países Bajos con topes oficiales", () => {
  validateTravelData(travelData);
  const destination = travelData.foreign.find((item) => item.label === "Països Baixos");
  const result = calculateTravel({
    funding: "uv", destinationType: "foreign", foreignId: destination.id, lodgingDays: 3,
    actualLodging: 510, fullMealDays: 2, halfMealDays: 2, publicTransport: 185,
    registration: 420, kilometres: 0, vehicle: "car", distance: 1800, exceedsWorkday: true
  }, travelData);
  assert.equal(result.breakdown.lodging, 510);
  assert.equal(result.breakdown.meals, 274.05);
  assert.equal(result.total, 1389.05);
});

test("no aplica cuantías UV a una ayuda con otro régimen", () => {
  const result = calculateTravel({ funding: "age-gva" }, travelData);
  assert.equal(result.applicable, false);
  assert.equal(result.total, null);
});

test("estima coste patronal temporal y reserva de un contrato anual", () => {
  const result = estimatePersonnelCost({
    grossAnnual: 32000, months: 12, contractType: "fixed", accidentRate: 1.5,
    otherRate: 0, otherCosts: 0, reserveRate: 2
  });
  assert.equal(result.contributionTotal, 10672);
  assert.equal(result.total, 43525.44);
  assert.equal(result.monthlyAverage, 3627.12);
});
