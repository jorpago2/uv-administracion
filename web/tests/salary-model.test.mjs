import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateSalary, getAutonomicAnnual } from "../salary-model.js";

const data = JSON.parse(await readFile(new URL("../data/salaries-2026.json", import.meta.url), "utf8"));

test("calcula la retribución base anual de CU funcionario", () => {
  const result = calculateSalary(data, selection("cu", "tc"));
  assert.equal(result.breakdown.salary, 18358.98);
  assert.equal(result.annual, 50732.02);
  assert.equal(result.perPayment, 3623.72);
});

test("reproduce el salario anual publicado para Ayudante Doctor", () => {
  const result = calculateSalary(data, selection("assistant_doctor", "tc"));
  assert.equal(result.annual, 33150.60);
});

test("calcula catorce pagas para PDI laboral asociado", () => {
  const result = calculateSalary(data, { ...selection("associate", "p6"), triennia: 1 });
  assert.equal(result.breakdown.triennia, 375.62);
  assert.equal(result.annual, 12426.82);
});

test("suma trienios, quinquenios, sexenios y tramo autonómico", () => {
  const result = calculateSalary(data, {
    ...selection("tu", "tc"),
    triennia: 3,
    teachingPeriods: 2,
    researchPeriods: 3,
    includeAutonomic: true
  });
  assert.equal(result.breakdown.autonomic, 1320);
  assert.equal(result.annual, 54278.08);
  assert.equal(result.perPayment, 3877.01);
});

test("añade el cargo de dirección de instituto", () => {
  const result = calculateSalary(data, { ...selection("tu", "tc"), roleId: "institute_director" });
  assert.equal(result.breakdown.academicRole, 3800.44);
  assert.equal(result.annual, 44100.22);
});

test("aplica los cuatro tramos autonómicos de 2026", () => {
  assert.equal(getAutonomicAnnual(data.autonomicTiers, 3), 0);
  assert.equal(getAutonomicAnnual(data.autonomicTiers, 4), 1320);
  assert.equal(getAutonomicAnnual(data.autonomicTiers, 6), 1980);
  assert.equal(getAutonomicAnnual(data.autonomicTiers, 8), 2640);
  assert.equal(getAutonomicAnnual(data.autonomicTiers, 10), 3300);
});

test("no aplica el tramo autonómico a una categoría no elegible", () => {
  const result = calculateSalary(data, {
    ...selection("associate", "p6"),
    teachingPeriods: 2,
    researchPeriods: 2,
    includeAutonomic: true
  });
  assert.equal(result.breakdown.autonomic, 0);
});

function selection(categoryId, dedicationId) {
  return {
    categoryId,
    dedicationId,
    triennia: 0,
    teachingPeriods: 0,
    researchPeriods: 0,
    includeAutonomic: false,
    otherAutonomic: 0,
    roleId: "none"
  };
}
