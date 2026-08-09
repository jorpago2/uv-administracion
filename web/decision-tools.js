import casesData from "./data/decision-cases.json";
import travelData from "./data/travel-2026.json";
import { calculatePod, calculateTravel, classifyPurchase, estimatePersonnelCost, validateTravelData } from "./decision-tools-model.js";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const hours = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

export function initDecisionTools(root) {
  if (!root) throw new Error("No se encontró el bloque de calculadoras operativas.");
  validateTravelData(travelData);
  validateCases(casesData);
  populateForeignDestinations(root.querySelector("#travelForeign"));
  root.querySelector("#personnelForm").addEventListener("input", updatePersonnelFields);
  root.querySelector("#personnelForm").addEventListener("change", updatePersonnelFields);
  bindCalculator(root, "#podForm", renderPod);
  bindCalculator(root, "#purchaseForm", renderPurchase);
  bindCalculator(root, "#travelForm", renderTravel);
  bindCalculator(root, "#personnelForm", renderPersonnel);
  root.querySelector("#travelDestinationType").addEventListener("change", updateTravelFields);
  root.querySelector("#travelFunding").addEventListener("change", updateTravelFields);
  root.querySelector("#travelHighOffice").addEventListener("change", updateTravelFields);
  root.querySelector("#travelForm").addEventListener("reset", () => requestAnimationFrame(updateTravelFields));
  updateTravelFields();
  updatePersonnelFields();
  renderCases(root.querySelector("#decisionCaseList"));
  root.addEventListener("click", handleExampleClick);
  root.querySelector(".case-filters").addEventListener("click", (event) => handleCaseFilter(event, root));
  root.querySelectorAll("form").forEach((form) => form.dispatchEvent(new Event("input", { bubbles: true })));
}

function bindCalculator(root, selector, render) {
  const form = root.querySelector(selector);
  if (!form) throw new Error(`Falta el formulario ${selector}.`);
  const update = () => {
    try {
      render(form);
      form.dataset.state = "valid";
    } catch (error) {
      form.dataset.state = "error";
      const panel = form.closest(".decision-card");
      const message = error instanceof Error ? error.message : "No se pudo realizar el cálculo.";
      setText(panel, ".decision-result__primary", "Revisa los datos");
      setText(panel, ".decision-result__status", message);
      renderBreakdown(panel, []);
      renderOrderedSteps(panel, []);
      renderWarnings(panel, [message]);
    }
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("reset", () => requestAnimationFrame(update));
}

function renderPod(form) {
  const result = calculatePod({
    category: form.elements.category.value,
    course: form.elements.course.value,
    sexennia: form.elements.sexennia.value,
    active: form.elements.active.checked,
    inactiveYears: form.elements.inactiveYears.value,
    publicProjects: form.elements.publicProjects.value,
    exceptionalEuropean: form.elements.exceptionalEuropean.checked,
    erasmusProjects: form.elements.erasmusProjects.value,
    thesisHours: form.elements.thesisHours.value,
    age63: form.elements.age63.checked,
    otherHours: form.elements.otherHours.value
  });
  const panel = form.closest(".decision-card");
  setText(panel, ".decision-result__primary", `${hours.format(result.finalHours)} h`);
  setText(panel, ".decision-result__status", result.baselineRule);
  renderBreakdown(panel, [
    ["Dedicación base", `${hours.format(result.baseline)} h`],
    ["Proyectos públicos", `−${hours.format(result.reductions.project)} h`],
    ["Erasmus+", `−${hours.format(result.reductions.erasmus)} h`],
    ["Tesis", `−${hours.format(result.reductions.theses)} h`],
    ["Edad", `−${hours.format(result.reductions.age)} h`],
    ["Otras reconocidas", `−${hours.format(result.reductions.other)} h`],
    ["Resultado teórico", `${hours.format(result.theoretical)} h`]
  ]);
  renderWarnings(panel, result.warnings);
}

function renderPurchase(form) {
  const result = classifyPurchase({
    type: form.elements.type.value,
    amount: form.elements.amount.value,
    durationMonths: form.elements.durationMonths.value,
    recurring: form.elements.recurring.checked,
    framework: form.elements.framework.checked,
    exclusive: form.elements.exclusive.checked,
    periodicOrForeign: form.elements.periodicOrForeign.checked
  });
  const panel = form.closest(".decision-card");
  setText(panel, ".decision-result__primary", result.title);
  const statusText = result.status === "minor"
    ? "No realices el pedido hasta completar la adjudicación y el AD."
    : result.status === "excluded"
      ? "Gasto excluido del registro de contratos menores en UV-plyca; conserva la justificación contable."
      : "Ruta orientativa según IUV 1/2025.";
  setText(panel, ".decision-result__status", statusText);
  renderBreakdown(panel, [
    ["Importe sin IVA", money.format(result.amount)],
    ["Ofertas mínimas", result.offers ? String(result.offers) : "No aplica"],
    ["AD previo", ["excluded", "derived", "not-minor"].includes(result.status) ? "No aplica a esta ruta" : result.requiresAd ? "Sí" : "No, salvo excepción"],
    ["Límite menor", ["excluded", "derived"].includes(result.status) ? "No aplica" : money.format(result.minorLimit)]
  ]);
  renderOrderedSteps(panel, result.steps);
  renderWarnings(panel, result.warnings);
}

function renderTravel(form) {
  const result = calculateTravel({
    funding: form.elements.funding.value,
    destinationType: form.elements.destinationType.value,
    foreignId: form.elements.foreignId.value,
    departureDateTime: form.elements.departureDateTime.value,
    returnDateTime: form.elements.returnDateTime.value,
    actualLodging: form.elements.actualLodging.value,
    actualMeals: form.elements.actualMeals.value,
    highOffice: form.elements.highOffice.checked,
    publicTransport: form.elements.publicTransport.value,
    registration: form.elements.registration.value,
    kilometres: form.elements.kilometres.value,
    vehicle: form.elements.vehicle.value,
    distance: form.elements.distance.value,
    exceedsWorkday: form.elements.exceedsWorkday.checked
  }, travelData);
  const panel = form.closest(".decision-card");
  if (!result.applicable) {
    setText(panel, ".decision-result__primary", "Régimen distinto");
    setText(panel, ".decision-result__status", "No se calcula una cifra para evitar aplicar cuantías UV a otra financiación.");
    renderBreakdown(panel, []);
    renderWarnings(panel, result.warnings);
    return;
  }
  setText(panel, ".decision-result__primary", money.format(result.total));
  const rateSummary = result.highOffice
    ? "Importes reales justificados por alto cargo."
    : `Alojamiento ${money.format(result.lodgingRate)}/noche y manutención ${money.format(result.mealRate)}/día.`;
  setText(panel, ".decision-result__status", `Máximo planificado · ${result.destinationLabel}. ${result.lodgingDays} noche(s) y ${hours.format(result.mealUnits)} dieta(s) equivalentes. ${rateSummary}`);
  renderBreakdown(panel, [
    ["Alojamiento elegible", money.format(result.breakdown.lodging)],
    ["Manutención elegible", money.format(result.breakdown.meals)],
    ["Vehículo particular", money.format(result.breakdown.mileage)],
    ["Transporte público", money.format(result.breakdown.publicTransport)],
    ["Inscripción planificada", money.format(result.breakdown.registration)]
  ]);
  renderWarnings(panel, result.warnings);
}

function renderPersonnel(form) {
  const result = estimatePersonnelCost({
    grossAnnual: form.elements.grossAnnual.value,
    months: form.elements.months.value,
    contractType: form.elements.contractType.value,
    contributionGroup: form.elements.contributionGroup.value,
    monthlyHours: form.elements.monthlyHours.value,
    contractDays: form.elements.contractDays.value,
    shortTermSurchargeExempt: form.elements.shortTermSurchargeExempt.checked,
    accidentRate: form.elements.accidentRate.value,
    otherRate: form.elements.otherRate.value,
    otherCosts: form.elements.otherCosts.value,
    reserveRate: form.elements.reserveRate.value
  });
  const panel = form.closest(".decision-card");
  setText(panel, ".decision-result__primary", money.format(result.total));
  setText(panel, ".decision-result__status", `${money.format(result.monthlyAverage)} por mes de contrato, como promedio presupuestario.`);
  renderBreakdown(panel, [
    ["Salario bruto del periodo", money.format(result.salary)],
    [`Base mensual aplicada · grupo ${result.contributionGroup}`, money.format(result.contributionBaseMonthly)],
    ["Contingencias comunes · 23,60 %", money.format(result.contributions.common)],
    [`Desempleo · ${formatRate(result.rates.unemployment)}`, money.format(result.contributions.unemployment)],
    ["FOGASA · 0,20 %", money.format(result.contributions.fogasa)],
    ["Formación profesional · 0,60 %", money.format(result.contributions.training)],
    ["MEI · 0,75 %", money.format(result.contributions.mei)],
    [`AT/EP · ${formatRate(result.rates.accidents)}`, money.format(result.contributions.accidents)],
    [`Otros porcentajes · ${formatRate(result.rates.other)}`, money.format(result.contributions.other)],
    ["Cotización adicional de solidaridad", money.format(result.contributions.solidarity)],
    ["Contrato temporal inferior a 30 días", money.format(result.contributions.shortFixedTerm)],
    ["Otros costes", money.format(result.otherCosts)],
    ["Reserva", money.format(result.reserve)]
  ]);
  renderWarnings(panel, result.warnings);
}

function populateForeignDestinations(select) {
  const fragment = document.createDocumentFragment();
  travelData.foreign.forEach((destination) => {
    const option = document.createElement("option");
    option.value = destination.id;
    option.textContent = destination.label;
    fragment.append(option);
  });
  select.replaceChildren(fragment);
  const netherlands = travelData.foreign.find((item) => item.label === "Països Baixos");
  if (netherlands) select.value = netherlands.id;
}

function updateTravelFields() {
  const destinationType = document.querySelector("#travelDestinationType").value;
  const funding = document.querySelector("#travelFunding").value;
  const highOffice = document.querySelector("#travelHighOffice").checked;
  const foreignLabel = document.querySelector("#travelForeign").closest("label");
  foreignLabel.hidden = destinationType !== "foreign";
  document.querySelector("#travelForm").querySelectorAll("input, select").forEach((control) => {
    if (!["travelFunding", "travelDestinationType", "travelForeign"].includes(control.id)) control.disabled = funding !== "uv";
  });
  document.querySelector("#travelForeign").disabled = funding !== "uv" || destinationType !== "foreign";
  document.querySelector("#travelActualMeals").disabled = funding !== "uv" || !highOffice;
}

function updatePersonnelFields() {
  const form = document.querySelector("#personnelForm");
  const shortContract = Number(form.elements.months.value) < 1;
  const temporary = form.elements.contractType.value !== "indefinite";
  form.elements.contractDays.disabled = !shortContract;
  form.elements.shortTermSurchargeExempt.disabled = !shortContract || !temporary;
  if (!shortContract) {
    form.elements.contractDays.value = "";
    form.elements.shortTermSurchargeExempt.checked = false;
  }
}

function renderCases(container) {
  const fragment = document.createDocumentFragment();
  casesData.cases.forEach((item, index) => {
    const details = document.createElement("details");
    details.className = "case-file";
    details.dataset.caseCategory = item.category;
    if (index === 0) details.open = true;
    const summary = document.createElement("summary");
    const title = document.createElement("span");
    title.className = "case-file__title";
    title.innerHTML = `<small>${escapeHtml(item.area)}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.summary)}</span>`;
    const marker = document.createElement("span");
    marker.className = "case-file__marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "+";
    summary.append(title, marker);
    const body = document.createElement("div");
    body.className = "case-file__body";
    body.append(
      caseSection("Datos del caso", item.facts, false),
      caseSection("Decisión razonada", item.decision, true),
      caseSection("Documentos", item.documents, false),
      caseSection("Secuencia", item.timeline, true),
      caseSection("Errores a evitar", item.mistakes, false)
    );
    const outcome = document.createElement("p");
    outcome.className = "case-file__outcome";
    outcome.innerHTML = `<strong>Resultado:</strong> ${escapeHtml(item.result)}`;
    const actions = document.createElement("div");
    actions.className = "case-file__actions";
    if (item.tool) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "control control--primary";
      button.dataset.caseExample = item.id;
      button.textContent = "Cargar en calculadora";
      actions.append(button);
    }
    const link = document.createElement("a");
    link.href = item.sourceUrl;
    link.textContent = `Fuente · ${item.sourceLabel}`;
    actions.append(link);
    body.append(outcome, actions);
    details.append(summary, body);
    fragment.append(details);
  });
  container.replaceChildren(fragment);
}

function handleCaseFilter(event, root) {
  const button = event.target.closest("[data-case-filter]");
  if (!button) return;
  const filter = button.dataset.caseFilter;
  let visible = 0;
  root.querySelectorAll("[data-case-filter]").forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle("is-active", active);
    candidate.setAttribute("aria-pressed", String(active));
  });
  root.querySelectorAll(".case-file").forEach((item) => {
    const show = filter === "all" || item.dataset.caseCategory === filter;
    item.hidden = !show;
    if (show) visible += 1;
  });
  root.querySelector("#decisionCaseStatus").textContent = `${visible} ${visible === 1 ? "caso visible" : "casos visibles"}.`;
}

function caseSection(title, items, ordered) {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement(ordered ? "ol" : "ul");
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  });
  section.append(heading, list);
  return section;
}

function handleExampleClick(event) {
  const button = event.target.closest("[data-case-example]");
  if (!button) return;
  const example = EXAMPLES[button.dataset.caseExample];
  if (!example) return;
  const form = document.querySelector(example.form);
  Object.entries(example.values).forEach(([name, value]) => {
    const control = form.elements[name];
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = value;
  });
  if (form.id === "travelForm") updateTravelFields();
  if (form.id === "personnelForm") updatePersonnelFields();
  form.dispatchEvent(new Event("input", { bubbles: true }));
  const card = form.closest("details");
  card.open = true;
  card.scrollIntoView({ behavior: "smooth", block: "start" });
  form.querySelector("input, select").focus({ preventScroll: true });
}

const EXAMPLES = Object.freeze({
  "pod-tu-tres-sexenios": { form: "#podForm", values: { category: "permanent", course: "2027-28", sexennia: 3, active: true, inactiveYears: 0, publicProjects: 2, exceptionalEuropean: false, erasmusProjects: 0, thesisHours: 30, age63: false, otherHours: 0 } },
  "compra-osciloscopio-proyecto": { form: "#purchaseForm", values: { type: "research", amount: 18000, durationMonths: 4, recurring: false, framework: false, exclusive: false, periodicOrForeign: false } },
  "compra-sonda-exclusiva": { form: "#purchaseForm", values: { type: "supplies", amount: 9000, durationMonths: 2, recurring: false, framework: false, exclusive: true, periodicOrForeign: false } },
  "viaje-congreso-eindhoven": { form: "#travelForm", values: { funding: "uv", destinationType: "foreign", foreignId: travelData.foreign.find((item) => item.label === "Països Baixos")?.id || "", departureDateTime: "2026-09-14T09:00", returnDateTime: "2026-09-17T18:30", actualLodging: 510, actualMeals: 0, highOffice: false, publicTransport: 185, registration: 420, kilometres: 0, vehicle: "car", distance: 1800, exceedsWorkday: true } },
  "contrato-investigador-doce-meses": { form: "#personnelForm", values: { grossAnnual: 32000, months: 12, contractType: "fixed", contributionGroup: "1", monthlyHours: 160, contractDays: "", shortTermSurchargeExempt: false, accidentRate: 1.5, otherRate: 0, otherCosts: 0, reserveRate: 2 } }
});

function renderBreakdown(panel, rows) {
  const list = panel.querySelector(".decision-breakdown");
  list.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    row.append(dt, dd);
    return row;
  }));
}

function renderWarnings(panel, warnings) {
  const box = panel.querySelector(".decision-warnings");
  box.replaceChildren(...warnings.map((warning) => {
    const item = document.createElement("li");
    item.textContent = warning;
    return item;
  }));
  box.hidden = warnings.length === 0;
}

function renderOrderedSteps(panel, steps) {
  const list = panel.querySelector(".decision-steps");
  if (!list) return;
  list.replaceChildren(...steps.map((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    return item;
  }));
}

function setText(panel, selector, value) {
  panel.querySelector(selector).textContent = value;
}

function formatRate(value) {
  return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} %`;
}

function validateCases(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.cases) || data.cases.length < 4) throw new Error("Los casos completos no tienen el formato esperado.");
  const ids = new Set();
  data.cases.forEach((item) => {
    if (!item.id || ids.has(item.id) || !item.title || !item.sourceUrl) throw new Error("Hay un caso incompleto o duplicado.");
    if (!["docencia", "investigacion", "gestion", "cumplimiento"].includes(item.category)) throw new Error("Hay un caso sin ámbito válido.");
    ids.add(item.id);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
