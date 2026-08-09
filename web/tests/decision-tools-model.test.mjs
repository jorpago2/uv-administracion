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

test("aplica el umbral SARA 2026-2027 a bases de datos y suscripciones", () => {
  const below = classifyPurchase({ type: "database", amount: 215999.99, durationMonths: 12 });
  const threshold = classifyPurchase({ type: "database", amount: 216000, durationMonths: 12 });
  const extreme = classifyPurchase({ type: "database", amount: 100000000, durationMonths: 12 });
  assert.equal(below.status, "minor");
  assert.equal(below.offers, 3);
  assert.equal(threshold.status, "not-minor");
  assert.equal(extreme.status, "not-minor");
});

test("separa publicaciones, inscripciones y cuotas científicas de UV-plyca", () => {
  for (const type of ["scientific-publication", "conference-registration", "scientific-membership"]) {
    const result = classifyPurchase({ type, amount: 2000, durationMonths: 1 });
    assert.equal(result.status, "excluded");
    assert.equal(result.requiresAd, false);
    assert.match(result.steps.join(" "), /no (?:lo|la) registres como contrato menor/i);
  }
});

test("calcula el caso de viaje a Países Bajos con topes oficiales", () => {
  validateTravelData(travelData);
  const destination = travelData.foreign.find((item) => item.label === "Països Baixos");
  const result = calculateTravel({
    funding: "uv", destinationType: "foreign", foreignId: destination.id,
    departureDateTime: "2026-09-14T09:00", returnDateTime: "2026-09-17T18:30",
    actualLodging: 510, actualMeals: 0, publicTransport: 185,
    registration: 420, kilometres: 0, vehicle: "car", distance: 1800, exceedsWorkday: true
  }, travelData);
  assert.equal(result.lodgingDays, 3);
  assert.equal(result.mealUnits, 3.5);
  assert.equal(result.breakdown.lodging, 510);
  assert.equal(result.breakdown.meals, 319.73);
  assert.equal(result.total, 1434.73);
});

test("deriva únicamente dietas del 50 o 100 por ciento desde las horas", () => {
  const base = { funding: "uv", destinationType: "rest-spain", actualLodging: 0, actualMeals: 0, publicTransport: 0, registration: 0, kilometres: 0, vehicle: "car", distance: 50, exceedsWorkday: true };
  const half = calculateTravel({ ...base, departureDateTime: "2026-04-10T16:00", returnDateTime: "2026-04-10T22:00" }, travelData);
  const full = calculateTravel({ ...base, departureDateTime: "2026-04-10T09:00", returnDateTime: "2026-04-10T22:00" }, travelData);
  assert.equal(half.mealUnits, 0.5);
  assert.equal(half.breakdown.meals, 26.67);
  assert.equal(full.mealUnits, 1);
  assert.equal(full.breakdown.meals, 53.34);
  assert.throws(() => calculateTravel({ ...base, departureDateTime: "2026-04-10T22:00", returnDateTime: "2026-04-10T09:00" }, travelData), /posterior/);
});

test("aplica importes reales justificados a altos cargos", () => {
  const result = calculateTravel({
    funding: "uv", destinationType: "madrid-barcelona", departureDateTime: "2026-05-02T09:00", returnDateTime: "2026-05-03T22:00",
    actualLodging: 350, actualMeals: 180, highOffice: true, publicTransport: 0, registration: 0,
    kilometres: 0, vehicle: "car", distance: 350, exceedsWorkday: true
  }, travelData);
  assert.equal(result.breakdown.lodging, 350);
  assert.equal(result.breakdown.meals, 180);
  assert.equal(result.lodgingCap, null);
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

test("aplica base máxima, solidaridad y base mínima de cotización", () => {
  const high = estimatePersonnelCost({ grossAnnual: 100000, months: 12, contractType: "indefinite", contributionGroup: "1", monthlyHours: 160, accidentRate: 1.5 });
  assert.equal(high.contributionBase, 61214.40);
  assert.equal(high.contributions.solidarity, 413.19);
  assert.equal(high.contributionTotal, 20093.63);
  assert.equal(high.total, 120093.63);

  const low = estimatePersonnelCost({ grossAnnual: 12000, months: 12, contractType: "fixed", contributionGroup: "1", monthlyHours: 160, accidentRate: 1.5 });
  assert.equal(low.contributionBaseMonthly, 1989.30);
  assert.match(low.warnings.join(" "), /base mínima/);
});

test("añade el recargo de contrato corto y distingue desempleo reducido", () => {
  const short = estimatePersonnelCost({ grossAnnual: 24000, months: 0.5, contractDays: 15, contractType: "fixed", contributionGroup: "1", monthlyHours: 160, accidentRate: 1.5 });
  const exempt = estimatePersonnelCost({ grossAnnual: 24000, months: 0.5, contractDays: 15, contractType: "fixed-reduced", shortTermSurchargeExempt: true, contributionGroup: "1", monthlyHours: 160, accidentRate: 1.5 });
  assert.equal(short.contributions.shortFixedTerm, 33.62);
  assert.equal(exempt.contributions.shortFixedTerm, 0);
  assert.equal(exempt.rates.unemployment, 5.5);
  assert.throws(() => estimatePersonnelCost({ grossAnnual: 24000, months: 0.5, contractType: "fixed", contributionGroup: "1", monthlyHours: 160, accidentRate: 1.5 }), /duración exacta/);
});

test("usa la base mínima por hora en contratos a tiempo parcial", () => {
  const result = estimatePersonnelCost({ grossAnnual: 6000, months: 12, contractType: "indefinite", contributionGroup: "1", monthlyHours: 80, accidentRate: 1.5 });
  assert.equal(result.minimumMonthlyBase, 958.40);
  assert.equal(result.contributionBaseMonthly, 958.40);
});

test("advierte combinaciones POD contradictorias", () => {
  const result = calculatePod({ category: "permanent", course: "2029-30", sexennia: 3, active: true, inactiveYears: 8, publicProjects: 0, exceptionalEuropean: true });
  assert.equal(result.warnings.some((warning) => warning.includes("sexenio activo")), true);
  assert.equal(result.warnings.some((warning) => warning.includes("proyecto público")), true);
});
