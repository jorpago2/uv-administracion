import test from "node:test";
import assert from "node:assert/strict";
import {
  createSearchSnippet,
  matchesSearchQuery,
  prepareSearchEntry,
  rankSearchEntries,
  tokenizeSearchQuery
} from "../search-model.js";

const entries = [
  prepareSearchEntry({ id: "salary", title: "Calculadora de salario", category: "Carrera PDI", content: "Retribuciones, trienios, quinquenios y sexenios", priority: 10 }),
  prepareSearchEntry({ id: "patents", title: "Propiedad intelectual, patentes, software y secretos", category: "Investigación", content: "Comunica una invención protegible antes de publicar o acudir a un congreso" }),
  prepareSearchEntry({ id: "travel", title: "Viajes, congresos, dietas e inscripciones", category: "Gestión", content: "Autorización previa, alojamiento y transporte" })
];

test("la búsqueda ignora acentos, mayúsculas y palabras vacías", () => {
  assert.deepEqual(tokenizeSearchQuery("¿Cómo calcular la NÓMINA?"), ["calcular", "nomina"]);
  assert.equal(matchesSearchQuery(entries[0], "retribución sexenios"), true);
});

test("admite términos separados y ordena primero las coincidencias del título", () => {
  const results = rankSearchEntries(entries, "patente software");
  assert.deepEqual(results.map((entry) => entry.id), ["patents"]);
  assert.ok(rankSearchEntries(entries, "salario")[0].score > rankSearchEntries(entries, "sexenios")[0].score);
});

test("incluye sinónimos prácticos y tolera una errata corta", () => {
  assert.equal(rankSearchEntries(entries, "sueldo")[0].id, "salary");
  assert.equal(rankSearchEntries(entries, "patetne")[0].id, "patents");
});

test("genera un fragmento breve alrededor de la coincidencia", () => {
  const content = "Primero se identifica el resultado. Después se documentan las contribuciones. La invención debe comunicarse antes de publicar el resumen del congreso.";
  const snippet = createSearchSnippet(content, "invención", 90);
  assert.match(snippet, /invención/i);
  assert.ok(snippet.length <= 94);
});
