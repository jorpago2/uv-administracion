import { BUDGET_CATEGORY_LABELS, buildProjectBudgetMarkdown, calculateProjectBudget } from "./project-budget-model.js";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const percent = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
let rowSequence = 0;

export function initProjectBudget(root) {
  if (!root) throw new Error("No se encontró la calculadora de presupuesto de proyecto.");
  const form = root.querySelector("#projectBudgetForm");
  const elements = {
    form,
    years: form.elements.years,
    annualities: root.querySelector("#budgetAnnualities"),
    personnel: root.querySelector("#budgetPersonnelRows"),
    direct: root.querySelector("#budgetDirectRows"),
    addPersonnel: root.querySelector("#addBudgetPersonnel"),
    addDirect: root.querySelector("#addBudgetDirect"),
    download: root.querySelector("#downloadProjectBudget"),
    resultPrimary: root.querySelector(".decision-result__primary"),
    resultStatus: root.querySelector(".decision-result__status"),
    breakdown: root.querySelector(".decision-breakdown"),
    categories: root.querySelector("#budgetCategoryBody"),
    annualityBody: root.querySelector("#budgetAnnualityBody"),
    warnings: root.querySelector(".decision-warnings")
  };
  assertElements(elements);
  openFromHash(root);
  window.addEventListener("hashchange", () => openFromHash(root));
  loadExample(elements);
  elements.years.addEventListener("change", () => {
    renderAnnualityInputs(elements.annualities, Number(elements.years.value));
    update(elements);
  });
  form.addEventListener("input", () => update(elements));
  form.addEventListener("change", () => update(elements));
  elements.addPersonnel.addEventListener("click", () => {
    elements.personnel.append(createPersonnelRow());
    update(elements);
    elements.personnel.lastElementChild.querySelector("input").focus();
  });
  elements.addDirect.addEventListener("click", () => {
    elements.direct.append(createDirectRow());
    update(elements);
    elements.direct.lastElementChild.querySelector("input").focus();
  });
  form.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-budget-remove]");
    if (!remove) return;
    remove.closest(".budget-line").remove();
    update(elements);
  });
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    loadExample(elements);
  });
  elements.download.addEventListener("click", () => downloadBudget(elements));
  window.addEventListener("funding:budget-preset", (event) => applyFundingPreset(elements, event.detail));
}

function applyFundingPreset(elements, preset) {
  if (!preset || typeof preset !== "object") return;
  elements.form.elements.projectTitle.value = String(preset.projectTitle || "Candidatura de investigación");
  elements.form.elements.years.value = String(preset.years);
  elements.form.elements.fundingRate.value = String(preset.fundingRate);
  elements.form.elements.indirectRate.value = String(preset.indirectRate);
  elements.form.elements.grantCeiling.value = String(preset.grantCeiling);
  renderAnnualityInputs(elements.annualities, Number(preset.years));
  update(elements);
  elements.form.closest("details").open = true;
}

function loadExample(elements) {
  elements.form.elements.projectTitle.value = "Proyecto de sensor fotónico integrado";
  elements.form.elements.years.value = "3";
  elements.form.elements.fundingRate.value = "100";
  elements.form.elements.indirectRate.value = "25";
  elements.form.elements.reserveRate.value = "3";
  elements.form.elements.grantCeiling.value = "200000";
  renderAnnualityInputs(elements.annualities, 3, [30, 40, 30]);
  elements.personnel.replaceChildren(createPersonnelRow({ label: "Personal investigador", grossAnnual: 32000, months: 24 }));
  elements.direct.replaceChildren(
    createDirectRow({ label: "Equipamiento de laboratorio", category: "equipment", netAmount: 25000, vatRate: 21, vatTreatment: "eligible" }),
    createDirectRow({ label: "Material fungible", category: "consumables", netAmount: 10000, vatRate: 21, vatTreatment: "eligible" }),
    createDirectRow({ label: "Congresos y reuniones", category: "travel", netAmount: 12000, vatRate: 0, vatTreatment: "eligible" }),
    createDirectRow({ label: "Publicación y otros", category: "other", netAmount: 6000, vatRate: 21, vatTreatment: "eligible" })
  );
  update(elements);
}

function createPersonnelRow(values = {}) {
  const row = document.createElement("div");
  row.className = "budget-line budget-personnel-row";
  row.dataset.rowId = `personnel-${++rowSequence}`;
  row.append(
    labeledInput("Descripción", "label", "text", values.label ?? "Nueva contratación"),
    labeledInput("Bruto anual · €", "grossAnnual", "number", values.grossAnnual ?? 30000, { min: 0, max: 10000000, step: 0.01 }),
    labeledInput("Meses", "months", "number", values.months ?? 12, { min: 0.1, max: 60, step: 0.1 }),
    labeledSelect("Contrato", "contractType", [["indefinite", "Indefinido"], ["fixed", "Temporal · hipótesis"]], values.contractType ?? "fixed"),
    labeledInput("AT/EP · %", "accidentRate", "number", values.accidentRate ?? 1.5, { min: 0, max: 20, step: 0.01 }),
    labeledInput("Otros tipos · %", "otherRate", "number", values.otherRate ?? 0, { min: 0, max: 50, step: 0.01 }),
    labeledInput("Otros costes · €", "otherCosts", "number", values.otherCosts ?? 0, { min: 0, max: 10000000, step: 0.01 }),
    labeledInput("Elegible · %", "eligibilityPercent", "number", values.eligibilityPercent ?? 100, { min: 0, max: 100, step: 0.1 }),
    labeledCheck("Incluir en la base de indirectos", "indirectBase", values.indirectBase ?? true),
    removeButton("Quitar personal")
  );
  return row;
}

function createDirectRow(values = {}) {
  const row = document.createElement("div");
  row.className = "budget-line budget-direct-row";
  row.dataset.rowId = `direct-${++rowSequence}`;
  row.append(
    labeledInput("Descripción", "label", "text", values.label ?? "Nueva partida"),
    labeledSelect("Categoría", "category", Object.entries(BUDGET_CATEGORY_LABELS).filter(([key]) => key !== "personnel").map(([key, label]) => [key, label]), values.category ?? "equipment"),
    labeledInput("Importe sin IVA · €", "netAmount", "number", values.netAmount ?? 0, { min: 0, max: 100000000, step: 0.01 }),
    labeledInput("IVA · %", "vatRate", "number", values.vatRate ?? 21, { min: 0, max: 100, step: 0.01 }),
    labeledSelect("Tratamiento del IVA", "vatTreatment", [
      ["eligible", "Financiable / no recuperable"],
      ["recoverable", "Recuperable · no es coste"],
      ["not-eligible", "No financiable"]
    ], values.vatTreatment ?? "eligible"),
    labeledInput("Elegible · %", "eligibilityPercent", "number", values.eligibilityPercent ?? 100, { min: 0, max: 100, step: 0.1 }),
    labeledCheck("Incluir en la base de indirectos", "indirectBase", values.indirectBase ?? true),
    removeButton("Quitar partida")
  );
  return row;
}

function renderAnnualityInputs(container, years, values = null) {
  const current = [...container.querySelectorAll("input")].map((input) => Number(input.value));
  const distribution = values || (current.length === years && Math.abs(current.reduce((sum, value) => sum + value, 0) - 100) < 0.01
    ? current : evenDistribution(years));
  container.replaceChildren(...distribution.map((value, index) => labeledInput(`Anualidad ${index + 1} · %`, `annuality-${index + 1}`, "number", value, { min: 0, max: 100, step: 0.01 })));
}

function update(elements) {
  try {
    const result = calculateProjectBudget(readBudget(elements));
    elements.form.dataset.state = "valid";
    elements.download.disabled = false;
    elements.form._budgetResult = result;
    elements.resultPrimary.textContent = money.format(result.requestedFunding);
    elements.resultStatus.textContent = `Financiación solicitada · presupuesto económico ${money.format(result.economicBudget)} · necesidad con reserva ${money.format(result.plannedRequirement)}.`;
    renderBreakdown(elements.breakdown, [
      ["Costes directos", money.format(result.directEconomicCost)],
      ["Desembolso directo bruto", money.format(result.directCashOutlay)],
      ["Directos elegibles", money.format(result.eligibleDirectCost)],
      [`Indirectos · ${percent.format(result.indirectRate)} %`, money.format(result.indirectCosts)],
      ["Reserva de planificación", money.format(result.reserve)],
      ["Aportación propia/no financiada", money.format(result.ownContribution)],
      ["IVA recuperable · tesorería", money.format(result.recoverableVat)]
    ]);
    renderCategoryRows(elements.categories, result.categories);
    renderAnnualityRows(elements.annualityBody, result.annualities);
    renderWarnings(elements.warnings, result.warnings);
  } catch (error) {
    elements.form.dataset.state = "error";
    elements.form._budgetResult = null;
    elements.download.disabled = true;
    elements.resultPrimary.textContent = "Revisa los datos";
    elements.resultStatus.textContent = error instanceof Error ? error.message : "No se pudo calcular el presupuesto.";
    elements.breakdown.replaceChildren();
    elements.categories.replaceChildren();
    elements.annualityBody.replaceChildren();
    renderWarnings(elements.warnings, ["Corrige el campo indicado para recuperar el desglose."]);
  }
}

function readBudget(elements) {
  const form = elements.form;
  return {
    years: form.elements.years.value,
    fundingRate: form.elements.fundingRate.value,
    indirectRate: form.elements.indirectRate.value,
    reserveRate: form.elements.reserveRate.value,
    grantCeiling: form.elements.grantCeiling.value,
    annualityPercentages: [...elements.annualities.querySelectorAll("input")].map((input) => input.value),
    personnel: [...elements.personnel.querySelectorAll(".budget-personnel-row")].map((row) => readRow(row, ["label", "grossAnnual", "months", "contractType", "accidentRate", "otherRate", "otherCosts", "eligibilityPercent", "indirectBase"])),
    directItems: [...elements.direct.querySelectorAll(".budget-direct-row")].map((row) => readRow(row, ["label", "category", "netAmount", "vatRate", "vatTreatment", "eligibilityPercent", "indirectBase"]))
  };
}

function readRow(row, fields) {
  return Object.fromEntries(fields.map((field) => {
    const control = row.querySelector(`[data-budget-field="${field}"]`);
    return [field, control.type === "checkbox" ? control.checked : control.value];
  }));
}

function downloadBudget(elements) {
  const result = elements.form._budgetResult;
  if (!result) return;
  const title = elements.form.elements.projectTitle.value;
  const markdown = buildProjectBudgetMarkdown(title, result);
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(title || "presupuesto-proyecto")}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  elements.download.dataset.state = "success";
  elements.download.textContent = "Presupuesto descargado";
  window.setTimeout(() => {
    elements.download.dataset.state = "default";
    elements.download.textContent = "Descargar presupuesto .md";
  }, 1800);
}

function labeledInput(labelText, field, type, value, attributes = {}) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  input.dataset.budgetField = field;
  Object.entries(attributes).forEach(([name, attributeValue]) => input.setAttribute(name, String(attributeValue)));
  label.append(input);
  return label;
}

function labeledSelect(labelText, field, options, selected) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.dataset.budgetField = field;
  options.forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    option.selected = value === selected;
    select.append(option);
  });
  label.append(select);
  return label;
}

function labeledCheck(labelText, field, checked) {
  const label = document.createElement("label");
  label.className = "decision-check budget-line__check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.dataset.budgetField = field;
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(input, text);
  return label;
}

function removeButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control budget-line__remove";
  button.dataset.budgetRemove = "";
  button.textContent = label;
  return button;
}

function renderBreakdown(container, rows) {
  container.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
}

function renderCategoryRows(container, categories) {
  container.replaceChildren(...categories.map((category) => tableRow([category.label, money.format(category.economicCost), money.format(category.eligibleCost)])));
}

function renderAnnualityRows(container, annualities) {
  container.replaceChildren(...annualities.map((item) => tableRow([`Año ${item.year}`, `${percent.format(item.percentage)} %`, money.format(item.economicBudget), money.format(item.requestedFunding)])));
}

function tableRow(values) {
  const row = document.createElement("tr");
  values.forEach((value) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.append(cell);
  });
  return row;
}

function renderWarnings(container, warnings) {
  container.replaceChildren(...warnings.map((warning) => {
    const item = document.createElement("li");
    item.textContent = warning;
    return item;
  }));
}

function evenDistribution(years) {
  const base = Math.floor(10000 / years) / 100;
  const values = Array.from({ length: years }, () => base);
  values[values.length - 1] = Math.round((100 - base * (years - 1)) * 100) / 100;
  return values;
}

function slugify(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "presupuesto-proyecto";
}

function assertElements(elements) {
  const missing = Object.entries(elements).filter(([, element]) => !element).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan elementos del presupuesto: ${missing.join(", ")}.`);
}

function openFromHash(root) {
  if (window.location.hash === `#${root.id}`) root.open = true;
}
