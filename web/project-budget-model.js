import { estimatePersonnelCost } from "./decision-tools-model.js";

export const BUDGET_CATEGORY_LABELS = Object.freeze({
  personnel: "Personal",
  equipment: "Equipamiento",
  consumables: "Fungible",
  travel: "Viajes",
  subcontracting: "Subcontratación",
  other: "Otros costes directos"
});

const VAT_TREATMENTS = new Set(["eligible", "recoverable", "not-eligible"]);

export function calculateProjectBudget(input) {
  const years = integer(input.years, 1, 5, "anualidades");
  const fundingRate = numberInRange(input.fundingRate, 0, 100, "porcentaje de financiación");
  const indirectRate = numberInRange(input.indirectRate, 0, 100, "costes indirectos");
  const reserveRate = numberInRange(input.reserveRate ?? 0, 0, 50, "reserva");
  const grantCeiling = optionalMoney(input.grantCeiling);
  const annualityPercentages = validateAnnualities(input.annualityPercentages, years);
  const personnel = Array.isArray(input.personnel) ? input.personnel.map((line, index) => calculatePersonnelLine(line, index, years)) : [];
  const directItems = Array.isArray(input.directItems) ? input.directItems.map(calculateDirectLine) : [];
  const lines = [...personnel, ...directItems];
  if (!lines.length) throw new Error("Añade al menos una partida de personal o gasto directo.");

  const directEconomicCost = roundMoney(sum(lines, "economicCost"));
  const directCashOutlay = roundMoney(sum(lines, "cashOutlay"));
  const eligibleDirectCost = roundMoney(sum(lines, "eligibleCost"));
  const recoverableVat = roundMoney(sum(lines, "recoverableVat"));
  const indirectBase = roundMoney(lines.filter((line) => line.indirectBase).reduce((total, line) => total + line.eligibleCost, 0));
  const indirectCosts = roundMoney(indirectBase * indirectRate / 100);
  const eligibleBudget = roundMoney(eligibleDirectCost + indirectCosts);
  const economicBudget = roundMoney(directEconomicCost + indirectCosts);
  const reserve = roundMoney(economicBudget * reserveRate / 100);
  const plannedRequirement = roundMoney(economicBudget + reserve);
  const requestedBeforeCeiling = roundMoney(eligibleBudget * fundingRate / 100);
  const requestedFunding = grantCeiling === null ? requestedBeforeCeiling : Math.min(requestedBeforeCeiling, grantCeiling);
  const overCeiling = roundMoney(requestedBeforeCeiling - requestedFunding);
  const ownContribution = roundMoney(plannedRequirement - requestedFunding);
  const categories = buildCategorySummary(lines);
  const annualities = annualityPercentages.map((percentage, index) => ({
    year: index + 1,
    percentage,
    economicBudget: roundMoney(economicBudget * percentage / 100),
    requestedFunding: roundMoney(requestedFunding * percentage / 100)
  }));
  reconcileAnnualities(annualities, economicBudget, requestedFunding);

  const warnings = ["La convocatoria y su resolución prevalecen: confirma categorías, IVA, base de indirectos, cofinanciación y límites antes de presentar."];
  if (personnel.length) warnings.push("El coste de personal usa tipos empresariales de 2026; para anualidades futuras debe actualizarse con el cálculo de la unidad de personal.");
  if (indirectRate > 0 && indirectBase === 0) warnings.push("Has indicado costes indirectos, pero ninguna partida forma parte de su base.");
  if (overCeiling > 0) warnings.push("El límite de la ayuda reduce la financiación solicitada; la diferencia pasa a aportación propia o debe recortarse.");
  if (reserve > 0) warnings.push("La reserva se usa para planificación y no se considera financiable salvo que la convocatoria permita incluirla como partida.");
  if (recoverableVat > 0) warnings.push("El IVA recuperable se muestra como necesidad temporal de tesorería, pero no como coste elegible ni coste económico.");
  if (lines.some((line) => line.eligibilityPercent < 100 || line.ineligibleVat > 0)) warnings.push("Hay costes total o parcialmente no financiables que deberá cubrir la UV u otra fuente.");

  return {
    years, fundingRate, indirectRate, reserveRate, grantCeiling, annualityPercentages,
    lines, categories, directEconomicCost, directCashOutlay, eligibleDirectCost, recoverableVat,
    indirectBase, indirectCosts, eligibleBudget, economicBudget, reserve, plannedRequirement,
    requestedBeforeCeiling, requestedFunding: roundMoney(requestedFunding), overCeiling, ownContribution,
    annualities, warnings
  };
}

export function buildProjectBudgetMarkdown(projectTitle, result) {
  const title = String(projectTitle || "Proyecto sin título").trim() || "Proyecto sin título";
  const rows = result.lines.map((line) => `| ${escapeTable(line.label)} | ${BUDGET_CATEGORY_LABELS[line.category]} | ${formatNumber(line.economicCost)} € | ${formatNumber(line.eligibleCost)} € | ${line.indirectBase ? "Sí" : "No"} |`);
  const annualities = result.annualities.map((item) => `| ${item.year} | ${formatNumber(item.percentage)} % | ${formatNumber(item.economicBudget)} € | ${formatNumber(item.requestedFunding)} € |`);
  return `# Presupuesto · ${title}

> Estimación generada localmente. Las bases, la convocatoria y la resolución de concesión prevalecen.

## Parámetros

- Financiación: ${formatNumber(result.fundingRate)} % de los costes elegibles.
- Costes indirectos: ${formatNumber(result.indirectRate)} % sobre una base de ${formatNumber(result.indirectBase)} €.
- Reserva de planificación: ${formatNumber(result.reserveRate)} %.
- Límite de ayuda: ${result.grantCeiling === null ? "sin indicar" : `${formatNumber(result.grantCeiling)} €`}.

## Partidas

| Partida | Categoría | Coste económico | Coste elegible | Base de indirectos |
|---|---|---:|---:|:---:|
${rows.join("\n")}

## Resumen

| Concepto | Importe |
|---|---:|
| Costes directos | ${formatNumber(result.directEconomicCost)} € |
| Costes directos elegibles | ${formatNumber(result.eligibleDirectCost)} € |
| Costes indirectos | ${formatNumber(result.indirectCosts)} € |
| Presupuesto económico | ${formatNumber(result.economicBudget)} € |
| Reserva | ${formatNumber(result.reserve)} € |
| Necesidad total planificada | ${formatNumber(result.plannedRequirement)} € |
| Financiación solicitada | ${formatNumber(result.requestedFunding)} € |
| Aportación propia o no financiada | ${formatNumber(result.ownContribution)} € |

## Anualidades

| Anualidad | Distribución | Presupuesto | Financiación solicitada |
|---:|---:|---:|---:|
${annualities.join("\n")}

## Comprobaciones pendientes

${result.warnings.map((warning) => `- ${warning}`).join("\n")}
`;
}

function calculatePersonnelLine(line, index, years) {
  const label = cleanLabel(line.label, `Personal ${index + 1}`);
  const eligiblePercent = numberInRange(line.eligibilityPercent ?? 100, 0, 100, `elegibilidad de ${label}`);
  const months = numberInRange(line.months, 0.1, 60, `meses de ${label}`);
  if (months > years * 12) throw new RangeError(`${label} dura ${formatNumber(months)} meses y supera las ${years} anualidad(es) del proyecto.`);
  const estimate = estimatePersonnelCost({
    grossAnnual: line.grossAnnual,
    months,
    contractType: line.contractType,
    contributionGroup: line.contributionGroup ?? "1",
    monthlyHours: line.monthlyHours ?? 160,
    contractDays: line.contractDays ?? "",
    shortTermSurchargeExempt: Boolean(line.shortTermSurchargeExempt),
    accidentRate: line.accidentRate,
    otherRate: line.otherRate ?? 0,
    otherCosts: line.otherCosts ?? 0,
    reserveRate: 0
  });
  return {
    id: String(line.id || `personnel-${index + 1}`), label, category: "personnel", kind: "personnel",
    economicCost: estimate.total, cashOutlay: estimate.total,
    eligibleCost: roundMoney(estimate.total * eligiblePercent / 100), recoverableVat: 0, ineligibleVat: 0,
    eligibilityPercent: eligiblePercent, indirectBase: Boolean(line.indirectBase), months, detail: estimate
  };
}

function calculateDirectLine(line, index) {
  const category = oneOf(line.category, Object.keys(BUDGET_CATEGORY_LABELS).filter((key) => key !== "personnel"), "categoría de gasto");
  const label = cleanLabel(line.label, `Partida ${index + 1}`);
  const netAmount = numberInRange(line.netAmount, 0, 100_000_000, `importe de ${label}`);
  const vatRate = numberInRange(line.vatRate ?? 0, 0, 100, `IVA de ${label}`);
  const eligibilityPercent = numberInRange(line.eligibilityPercent ?? 100, 0, 100, `elegibilidad de ${label}`);
  const vatTreatment = oneOf(line.vatTreatment, [...VAT_TREATMENTS], `tratamiento de IVA de ${label}`);
  const vat = roundMoney(netAmount * vatRate / 100);
  const gross = roundMoney(netAmount + vat);
  const economicCost = vatTreatment === "recoverable" ? netAmount : gross;
  const eligibleVat = vatTreatment === "eligible" ? vat : 0;
  const eligibleBase = netAmount + eligibleVat;
  return {
    id: String(line.id || `direct-${index + 1}`), label, category, kind: "direct", netAmount, vatRate, vatTreatment,
    vat, economicCost: roundMoney(economicCost), cashOutlay: gross,
    eligibleCost: roundMoney(eligibleBase * eligibilityPercent / 100),
    recoverableVat: vatTreatment === "recoverable" ? vat : 0,
    ineligibleVat: vatTreatment === "not-eligible" ? vat : 0,
    eligibilityPercent, indirectBase: Boolean(line.indirectBase)
  };
}

function validateAnnualities(values, years) {
  if (!Array.isArray(values) || values.length !== years) throw new RangeError(`Indica exactamente ${years} porcentaje(s) de anualidad.`);
  const percentages = values.map((value, index) => numberInRange(value, 0, 100, `anualidad ${index + 1}`));
  const total = percentages.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 100) > 0.01) throw new RangeError(`Las anualidades deben sumar 100 %; ahora suman ${formatNumber(total)} %.`);
  return percentages;
}

function buildCategorySummary(lines) {
  return Object.keys(BUDGET_CATEGORY_LABELS).map((category) => {
    const categoryLines = lines.filter((line) => line.category === category);
    return {
      category,
      label: BUDGET_CATEGORY_LABELS[category],
      economicCost: roundMoney(sum(categoryLines, "economicCost")),
      eligibleCost: roundMoney(sum(categoryLines, "eligibleCost"))
    };
  }).filter((item) => item.economicCost || item.eligibleCost);
}

function reconcileAnnualities(annualities, economicBudget, requestedFunding) {
  if (!annualities.length) return;
  const last = annualities.at(-1);
  last.economicBudget = roundMoney(last.economicBudget + economicBudget - sum(annualities, "economicBudget"));
  last.requestedFunding = roundMoney(last.requestedFunding + requestedFunding - sum(annualities, "requestedFunding"));
}

function optionalMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = numberInRange(value, 0, 100_000_000, "límite de la ayuda");
  return number === 0 ? null : number;
}

function cleanLabel(value, fallback) {
  const label = String(value || "").trim();
  return label || fallback;
}

function sum(items, field) {
  return items.reduce((total, item) => total + Number(item[field] || 0), 0);
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new RangeError(`Valor no válido para ${label}.`);
  return value;
}

function numberInRange(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new RangeError(`${label} debe estar entre ${min} y ${max}.`);
  return number;
}

function integer(value, min, max, label) {
  const number = numberInRange(value, min, max, label);
  if (!Number.isInteger(number)) throw new RangeError(`${label} debe ser un número entero.`);
  return number;
}

function roundMoney(value) {
  const scaled = value * 100;
  return Math.round(scaled + Number.EPSILON * Math.max(1, Math.abs(scaled)) * 2) / 100;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}

function escapeTable(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
