import salaryData from "./data/salaries-2026.json";
import { calculateSalary, validateSalaryData } from "./salary-model.js";

const currency = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const BREAKDOWN_LABELS = Object.freeze({
  salary: "Sueldo base",
  destination: "Complemento de destino",
  specific: "Complemento específico",
  triennia: "Trienios",
  teachingPeriods: "Quinquenios docentes",
  researchPeriods: "Sexenios de investigación",
  autonomic: "Complemento autonómico por periodos",
  otherAutonomic: "Otros complementos autonómicos",
  academicRole: "Cargo académico"
});

export function initSalaryCalculator(root) {
  if (!root) throw new Error("Falta la calculadora retributiva.");
  validateSalaryData(salaryData);

  const elements = getElements(root);
  assertElements(elements);
  populateCategories(elements.category);
  populateRoles(elements.role);
  populateDedications(elements);
  render(elements);

  elements.form.addEventListener("input", () => render(elements));
  elements.category.addEventListener("change", () => {
    populateDedications(elements);
    render(elements);
  });
  elements.form.addEventListener("reset", () => window.setTimeout(() => {
    populateDedications(elements);
    render(elements);
  }));
}

function getElements(root) {
  return {
    root,
    form: root.querySelector("#salaryForm"),
    category: root.querySelector("#salaryCategory"),
    dedication: root.querySelector("#salaryDedication"),
    triennia: root.querySelector("#salaryTriennia"),
    teachingPeriods: root.querySelector("#salaryQuinquenios"),
    researchPeriods: root.querySelector("#salarySexenios"),
    includeAutonomic: root.querySelector("#includeAutonomic"),
    otherAutonomic: root.querySelector("#otherAutonomic"),
    role: root.querySelector("#academicRole"),
    annual: root.querySelector("#salaryAnnual"),
    perPayment: root.querySelector("#salaryPerPayment"),
    breakdown: root.querySelector("#salaryBreakdown"),
    hint: root.querySelector("#salaryAutonomicHint"),
    warning: root.querySelector("#salaryWarning"),
    status: root.querySelector("#salaryStatus")
  };
}

function assertElements(elements) {
  const missing = Object.entries(elements).filter(([, element]) => !element).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan controles retributivos: ${missing.join(", ")}`);
}

function populateCategories(select) {
  select.replaceChildren(...salaryData.categories.map((category) => createOption(
    category.id,
    `${category.label} · ${category.regime}`
  )));
}

function populateRoles(select) {
  select.replaceChildren(...salaryData.academicRoles.map((role) => createOption(
    role.id,
    role.annual ? `${role.label} · +${currency.format(role.annual)}/año` : role.label
  )));
}

function populateDedications(elements) {
  const category = salaryData.categories.find((item) => item.id === elements.category.value) ?? salaryData.categories[0];
  elements.dedication.replaceChildren(...category.dedications.map((profile) => createOption(profile.id, profile.label)));
  elements.includeAutonomic.disabled = !category.autonomicEligible;
  if (!category.autonomicEligible) elements.includeAutonomic.checked = false;
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function render(elements) {
  try {
    const result = calculateSalary(salaryData, {
      categoryId: elements.category.value,
      dedicationId: elements.dedication.value,
      triennia: elements.triennia.value,
      teachingPeriods: elements.teachingPeriods.value,
      researchPeriods: elements.researchPeriods.value,
      includeAutonomic: elements.includeAutonomic.checked,
      otherAutonomic: elements.otherAutonomic.value,
      roleId: elements.role.value
    });

    elements.annual.textContent = currency.format(result.annual);
    elements.perPayment.textContent = currency.format(result.perPayment);
    elements.breakdown.replaceChildren(...Object.entries(result.breakdown).map(([key, amount]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const value = document.createElement("dd");
      term.textContent = BREAKDOWN_LABELS[key];
      value.textContent = currency.format(amount);
      if (amount === 0) row.dataset.zero = "true";
      row.append(term, value);
      return row;
    }));

    const recognizedPeriods = Number(elements.teachingPeriods.value) + Number(elements.researchPeriods.value);
    const autonomicAmount = result.breakdown.autonomic;
    elements.hint.textContent = result.category.autonomicEligible
      ? `Con ${recognizedPeriods} periodos reconocidos, el tramo autonómico 2026 es ${currency.format(autonomicAmount)} anuales${elements.includeAutonomic.checked ? "." : "; actívalo solo si consta en resolución."}`
      : "Esta categoría no figura entre las beneficiarias de la convocatoria autonómica UV 2026.";

    const warnings = [];
    if (result.unavailableTeachingPeriods) warnings.push("La tabla UV no asigna quinquenios retributivos a esta dedicación; se computan a 0 €.");
    if (result.unavailableResearchPeriods) warnings.push("La tabla UV no asigna sexenios retributivos a esta dedicación; se computan a 0 €.");
    if (result.exceedsAutonomicCap) warnings.push(`Los complementos autonómicos introducidos superan el límite orientativo del 40 % (${currency.format(result.autonomicCap)}). Revisa la resolución individual.`);
    elements.warning.hidden = warnings.length === 0;
    elements.warning.textContent = warnings.join(" ");
    elements.status.textContent = `Estimación actualizada: ${currency.format(result.annual)} brutos anuales y ${currency.format(result.perPayment)} por paga.`;
  } catch (error) {
    elements.annual.textContent = "—";
    elements.perPayment.textContent = "—";
    elements.breakdown.replaceChildren();
    elements.hint.textContent = "Corrige el campo indicado para volver a calcular.";
    elements.warning.hidden = false;
    elements.warning.textContent = error.message;
    elements.status.textContent = "No se pudo calcular la retribución.";
  }
}
