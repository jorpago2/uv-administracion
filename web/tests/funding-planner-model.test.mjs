import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FUNDING_RULE_PACKAGES, getRulePackage } from "../funding-planner-data.js";
import { buildApplicationPlan, buildPlanIcs, buildPlanMarkdown, evaluateEligibility } from "../funding-planner-model.js";

const funding = JSON.parse(await readFile(new URL("../data/funding-calls.json", import.meta.url), "utf8"));
const call = (id) => funding.calls.find((item) => item.id === id);
const yes = (values = {}) => new Proxy(values, { get: (target, property) => property in target ? target[property] : "yes" });

test("todos los paquetes específicos enlazan convocatorias y fuentes oficiales seguras", () => {
  const callIds = new Set(funding.calls.map((item) => item.id));
  for (const rulePackage of FUNDING_RULE_PACKAGES) {
    assert.match(rulePackage.source.url, /^https:\/\//);
    assert.match(rulePackage.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(rulePackage.questions.length >= 5);
    assert.ok(rulePackage.callIds.every((id) => callIds.has(id)));
  }
  assert.equal(getRulePackage("erc-starting").id, "erc-career-2027");
  assert.equal(getRulePackage("erc-advanced").id, "generic");
});

test("calcula las ventanas ERC 2027 con la defensa y extensiones declaradas", () => {
  const starting = evaluateEligibility(call("erc-starting"), yes({ phdDate: "2018-06-15", extensionMonths: "0" }), "2026-10-14");
  assert.equal(starting.status, "pass");
  assert.match(starting.checks.find((item) => item.label === "Ventana desde el doctorado").detail, /1 ene 2017/);

  const tooOld = evaluateEligibility(call("erc-starting"), yes({ phdDate: "2016-12-31", extensionMonths: "0" }), "2026-10-14");
  assert.equal(tooOld.status, "block");

  const extended = evaluateEligibility(call("erc-starting"), yes({ phdDate: "2016-12-31", extensionMonths: "1" }), "2026-10-14");
  assert.equal(extended.status, "pass");

  const consolidator = evaluateEligibility(call("erc-consolidator"), yes({ phdDate: "2014-05-20", extensionMonths: "0" }), "2027-01-12");
  assert.equal(consolidator.status, "pass");
});

test("MSCA-PF aplica experiencia equivalente, movilidad y restricción de reenvío", () => {
  const pass = evaluateEligibility(call("msca-pf"), yes({
    fellowshipType: "european", researchYears: "8.5", excludedYears: "1", mobilityMonths: "12",
    previousSubmission: "no", previousScore: ""
  }), "2026-09-09");
  assert.equal(pass.status, "pass");

  const blocked = evaluateEligibility(call("msca-pf"), yes({
    fellowshipType: "global", researchYears: "5", excludedYears: "0", mobilityMonths: "13",
    previousSubmission: "yes", previousScore: "79"
  }), "2026-09-09");
  assert.equal(blocked.status, "block");
  assert.equal(blocked.checks.filter((item) => item.status === "block").length, 2);
});

test("GE comprueba doctorado, composición y exclusividades de todo el grupo", () => {
  const pass = evaluateEligibility(call("gva-ge"), yes({ doctorCount: "3", phdDate: "2019-02-01", extensionYears: "0" }), "2026-11-21");
  assert.equal(pass.status, "pass");

  const blocked = evaluateEligibility(call("gva-ge"), yes({ doctorCount: "2", phdDate: "2015-12-31", extensionYears: "0", noFormerPi: "no" }), "2026-11-21");
  assert.equal(blocked.status, "block");
  assert.equal(blocked.checks.filter((item) => item.status === "block").length, 3);
});

test("AICO y PROMETEO aplican sus umbrales diferentes", () => {
  const aico = evaluateEligibility(call("gva-aico"), yes({ piCount: "2", additionalDoctors: "3", groupMeritRoute: "sexennia" }), "2026-12-19");
  assert.equal(aico.status, "pass");
  const aicoSmall = evaluateEligibility(call("gva-aico"), yes({ piCount: "2", additionalDoctors: "2", groupMeritRoute: "projects" }), "2026-12-19");
  assert.equal(aicoSmall.status, "block");

  const prometeo = evaluateEligibility(call("gva-prometeo"), yes({ piCount: "1", additionalDoctors: "5", groupMeritRoute: "projects" }), "2026-12-19");
  assert.equal(prometeo.status, "pass");
});

test("PDC y EIC Transition distinguen resultado de origen, TRL y controles operativos", () => {
  const pdc = evaluateEligibility(call("aei-pdc"), yes({ rightsClear: "unknown" }), "2027-07-10");
  assert.equal(pdc.status, "review");

  const eic = evaluateEligibility(call("eic-transition"), yes({ achievedTrl: "3", techMarketTeam: "no" }), "2026-09-16");
  assert.equal(eic.status, "review");
  assert.equal(eic.checks.some((item) => item.label === "TRL alcanzado" && item.status === "pass"), true);

  const wrongTrl = evaluateEligibility(call("eic-transition"), yes({ achievedTrl: "5" }), "2026-09-16");
  assert.equal(wrongTrl.status, "block");
});

test("las vías con empresa exigen un papel UV contractual definido", () => {
  const blocked = evaluateEligibility(call("cdti-id"), yes({ uvRole: "advisor" }), "2027-06-30");
  assert.equal(blocked.status, "block");
  const review = evaluateEligibility(call("cdti-id"), yes({ uvRole: "subcontractor", agreementReviewed: "no" }), "2027-06-30");
  assert.equal(review.status, "review");
  const ivace = evaluateEligibility(call("ivace-innovacion"), yes({ uvRole: "subcontractor" }), "2027-06-30");
  assert.equal(ivace.rulePackage.source.url, call("ivace-innovacion").source.url);
});

test("una vía sin comprobador específico nunca se presenta como elegibilidad certificada", () => {
  const result = evaluateEligibility(call("erc-advanced"), yes(), "2027-08-28");
  assert.equal(result.status, "review");
  assert.equal(result.checks.at(-1).label, "Validación específica de la edición");
});

test("genera un calendario inverso ordenado y exige cierre interno anterior", () => {
  const eligibility = evaluateEligibility(call("aei-pdc"), yes(), "2027-03-31");
  const plan = buildApplicationPlan(call("aei-pdc"), {
    projectTitle: "Memristor fotónico transferible", role: "pi",
    externalDeadline: "2027-03-31", internalDeadline: "2027-03-20"
  }, eligibility, new Date("2026-08-09T12:00:00"));
  assert.equal(plan.milestones[0].isoDate, "2026-09-30");
  assert.equal(plan.milestones.at(-1).isoDate, "2027-03-31");
  assert.ok(plan.milestones.some((item) => item.title === "Cierre interno UV" && item.isoDate === "2027-03-20"));
  assert.ok(plan.milestones.every((item, index) => index === 0 || item.isoDate >= plan.milestones[index - 1].isoDate));

  assert.throws(() => buildApplicationPlan(call("aei-pdc"), {
    externalDeadline: "2027-03-31", internalDeadline: "2027-04-01"
  }, eligibility), /anterior/);
});

test("exporta el mismo plan a Markdown auditable e iCalendar", () => {
  const eligibility = evaluateEligibility(call("eic-transition"), yes({ achievedTrl: "4" }), "2027-05-20");
  const plan = buildApplicationPlan(call("eic-transition"), {
    projectTitle: "PIC neuromórfico, fase 2", externalDeadline: "2027-05-20", internalDeadline: "2027-05-10"
  }, eligibility, new Date("2026-08-09T12:00:00"));
  const markdown = buildPlanMarkdown(plan, eligibility);
  assert.match(markdown, /^# PIC neuromórfico, fase 2/m);
  assert.match(markdown, /## Calendario inverso/);
  assert.match(markdown, /Fuente de reglas/);

  const ics = buildPlanIcs(plan);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /SUMMARY:EIC Transition ·/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, plan.milestones.length);
  assert.match(ics, /PIC neuromórfico\\, fase 2/);
});
