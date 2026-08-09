import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AREA_LABELS,
  buildIcsCalendar,
  filterProcedures,
  recommendProcedures,
  validateOperationsData
} from "../operational-tools-model.js";

const operations = JSON.parse(await readFile(new URL("../data/operations.json", import.meta.url), "utf8"));
const manual = await readFile(new URL("../../MANUAL_PROCEDIMIENTOS.md", import.meta.url), "utf8");

test("valida 27 fichas y 12 hitos operativos", () => {
  const validated = validateOperationsData(operations);
  assert.equal(validated.procedures.length, 27);
  assert.equal(validated.milestones.length, 12);
});

test("las fichas cubren todos los ámbitos y enlazan capítulos reales", () => {
  const areas = new Set(operations.procedures.map((procedure) => procedure.area));
  const chapters = new Map([...manual.matchAll(/^## (\d+)\. (.+)$/gm)].map((match) => [Number(match[1]), slugify(match[2])]));
  assert.deepEqual(areas, new Set(Object.keys(AREA_LABELS)));
  for (const procedure of operations.procedures) {
    assert.equal(procedure.anchor, chapters.get(procedure.chapter), procedure.id);
    assert.ok(procedure.sourceUrl.startsWith("https://"), procedure.id);
  }
});

test("el asistente prioriza ámbito, papel y momento", () => {
  const results = recommendProcedures(operations.procedures, {
    area: "investigacion",
    role: "ip",
    moment: "cerrar"
  });
  assert.equal(results.length, 4);
  assert.ok(results.every((procedure) => procedure.area === "investigacion"));
  assert.ok(results[0].roles.includes("ip"));
  assert.ok(results[0].moments.includes("cerrar"));
});

test("el asistente ofrece una portada de cuatro trámites frecuentes", () => {
  const results = recommendProcedures(operations.procedures, { area: "all", role: "all", moment: "all" });
  assert.equal(results.length, 4);
  assert.ok(results.every((procedure) => procedure.featured));
});

test("el buscador de fichas ignora mayúsculas y acentos", () => {
  const results = filterProcedures(operations.procedures, "all", "evaluacion etica");
  assert.ok(results.some((procedure) => procedure.id === "estudio-personas"));
});

test("genera un calendario iCalendar válido y determinista", () => {
  const calendar = buildIcsCalendar(
    operations.milestones.slice(0, 2),
    2027,
    "https://example.org/uv-administracion/?v=1#inicio",
    new Date("2026-08-08T12:00:00Z")
  );
  assert.ok(calendar.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(calendar.endsWith("END:VCALENDAR\r\n"));
  assert.equal((calendar.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(calendar, /DTSTART;VALUE=DATE:20270115/);
  assert.match(calendar, /DTSTAMP:20260808T120000Z/);
  assert.match(calendar, /URL:https:\/\/example\.org\/uv-administracion\/\?v=1#nomina-/);
  assert.doesNotMatch(calendar, /(?<!\r)\n/);
});

test("rechaza calendarios vacíos y años fuera de rango", () => {
  assert.throws(() => buildIcsCalendar([], 2027, "https://example.org"), /Selecciona/);
  assert.throws(() => buildIcsCalendar(operations.milestones, 1900, "https://example.org"), RangeError);
});

function slugify(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
