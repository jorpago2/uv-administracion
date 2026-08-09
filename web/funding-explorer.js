import fundingData from "./data/funding-calls.json";
import {
  FUNDING_BENEFICIARIES,
  FUNDING_FREQUENCIES,
  FUNDING_LEVELS,
  FUNDING_PARTICIPATION,
  FUNDING_PROFILES,
  FUNDING_PURPOSES,
  TRACEABILITY_LABELS,
  buildComparisonRows,
  filterFundingCalls,
  formatIsoDate,
  getTraceabilityStatus,
  updateComparison,
  validateFundingData
} from "./funding-explorer-model.js";

const TRL_OPTIONS = Object.freeze([
  ["all", "Cualquier madurez"],
  ["1", "TRL 1 · principios básicos"],
  ["2", "TRL 2 · concepto tecnológico"],
  ["3", "TRL 3 · prueba experimental"],
  ["4", "TRL 4 · validación en laboratorio"],
  ["5", "TRL 5 · entorno relevante"],
  ["6", "TRL 6 · demostración"],
  ["7", "TRL 7 · prototipo operativo"],
  ["8", "TRL 8 · sistema completo"],
  ["9", "TRL 9 · sistema probado"]
]);

export function initFundingExplorer(root) {
  if (!root) throw new Error("No se encontró el explorador de financiación.");
  const data = validateFundingData(fundingData);
  const elements = getElements(root);
  assertElements(elements);
  const state = { selected: [], limitMessage: "" };

  populateSelect(elements.level, FUNDING_LEVELS, "Todos los niveles");
  populateSelect(elements.purpose, FUNDING_PURPOSES, "Cualquier finalidad");
  populateSelect(elements.profile, FUNDING_PROFILES, "Cualquier perfil");
  populateSelect(elements.participation, FUNDING_PARTICIPATION, "Cualquier participación");
  populateSelect(elements.beneficiary, FUNDING_BENEFICIARIES, "Cualquier beneficiario");
  populateSelect(elements.frequency, FUNDING_FREQUENCIES, "Cualquier periodicidad");
  populateSelect(elements.trl, Object.fromEntries(TRL_OPTIONS.slice(1)), TRL_OPTIONS[0][1]);

  elements.callCount.textContent = String(data.calls.length);
  elements.levelCount.textContent = String(new Set(data.calls.map((call) => call.level)).size);
  elements.reviewedDate.textContent = formatIsoDate(data.reviewedOn);

  const render = () => renderExplorer(elements, data.calls, state);
  elements.form.addEventListener("input", render);
  elements.form.addEventListener("change", render);
  elements.form.addEventListener("reset", () => {
    state.limitMessage = "";
    requestAnimationFrame(render);
  });
  elements.cardList.addEventListener("change", (event) => handleComparisonToggle(event, elements, data.calls, state, render));
  elements.cardList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-plan-funding]");
    if (!button) return;
    root.dispatchEvent(new CustomEvent("funding:select", { detail: { callId: button.dataset.planFunding } }));
  });
  elements.clearComparison.addEventListener("click", () => {
    state.selected = [];
    state.limitMessage = "";
    render();
  });
  elements.comparisonContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-funding]");
    if (!button) return;
    state.selected = state.selected.filter((id) => id !== button.dataset.removeFunding);
    state.limitMessage = "";
    render();
  });
  render();
}

function getElements(root) {
  return {
    root,
    form: root.querySelector("#fundingFilters"),
    query: root.querySelector("#fundingQuery"),
    level: root.querySelector("#fundingLevel"),
    purpose: root.querySelector("#fundingPurpose"),
    profile: root.querySelector("#fundingProfile"),
    participation: root.querySelector("#fundingParticipation"),
    beneficiary: root.querySelector("#fundingBeneficiary"),
    trl: root.querySelector("#fundingTrl"),
    frequency: root.querySelector("#fundingFrequency"),
    cardList: root.querySelector("#fundingCardList"),
    status: root.querySelector("#fundingStatus"),
    activeFilters: root.querySelector("#fundingActiveFilters"),
    comparisonStatus: root.querySelector("#fundingComparisonStatus"),
    comparisonContent: root.querySelector("#fundingComparisonContent"),
    clearComparison: root.querySelector("#clearFundingComparison"),
    callCount: root.querySelector("#fundingCallCount"),
    levelCount: root.querySelector("#fundingLevelCount"),
    reviewedDate: root.querySelector("#fundingReviewedDate")
  };
}

function assertElements(elements) {
  const missing = Object.entries(elements).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan controles de financiación: ${missing.join(", ")}`);
}

function populateSelect(select, labels, allLabel) {
  const fragment = document.createDocumentFragment();
  fragment.append(createOption("all", allLabel));
  Object.entries(labels).forEach(([value, label]) => fragment.append(createOption(value, label)));
  select.replaceChildren(fragment);
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function getCriteria(elements) {
  return {
    query: elements.query.value.trim(),
    level: elements.level.value,
    purpose: elements.purpose.value,
    profile: elements.profile.value,
    participation: elements.participation.value,
    beneficiary: elements.beneficiary.value,
    trl: elements.trl.value,
    frequency: elements.frequency.value
  };
}

function renderExplorer(elements, calls, state) {
  const criteria = getCriteria(elements);
  const filtered = filterFundingCalls(calls, criteria);
  renderCards(elements, filtered, state);
  renderComparison(elements, calls, state);
  elements.status.textContent = `${filtered.length} ${filtered.length === 1 ? "vía compatible" : "vías compatibles"} de ${calls.length}.`;
  elements.activeFilters.textContent = describeActiveFilters(criteria);
}

function renderCards(elements, calls, state) {
  const fragment = document.createDocumentFragment();
  calls.forEach((call) => fragment.append(createFundingCard(call, state)));
  if (!calls.length) {
    const empty = document.createElement("div");
    empty.className = "funding-empty";
    const title = document.createElement("strong");
    title.textContent = "No hay coincidencias exactas";
    const copy = document.createElement("p");
    copy.textContent = "Retira un filtro obligatorio o revisa si el beneficiario debe ser la empresa en lugar de la UV.";
    empty.append(title, copy);
    fragment.append(empty);
  }
  elements.cardList.replaceChildren(fragment);
}

function createFundingCard(call, state) {
  const article = document.createElement("article");
  article.className = "funding-card";
  article.dataset.level = call.level;

  const header = document.createElement("header");
  header.className = "funding-card__heading";
  const tags = document.createElement("div");
  tags.className = "funding-card__tags";
  tags.append(createTag(FUNDING_LEVELS[call.level], "level"), createTag(FUNDING_FREQUENCIES[call.frequency], call.frequency));
  const title = document.createElement("h4");
  title.textContent = call.name;
  const profile = document.createElement("p");
  profile.textContent = call.profile;
  header.append(tags, title, profile);

  const facts = document.createElement("dl");
  facts.className = "funding-card__facts";
  appendFact(facts, "Finalidad", call.purposes.map((value) => FUNDING_PURPOSES[value]).join("; "));
  appendFact(facts, "Participación", FUNDING_PARTICIPATION[call.participation]);
  appendFact(facts, "TRL orientativo", call.trl ? `${call.trl.min}–${call.trl.max}` : "No es el criterio principal");
  appendFact(facts, "Duración", call.duration);
  appendFact(facts, "Financiación", call.budget, true);

  const details = document.createElement("details");
  details.className = "funding-card__details";
  const summary = document.createElement("summary");
  summary.textContent = "Condiciones y trazabilidad";
  const detailBody = document.createElement("div");
  detailBody.className = "funding-card__detail-body";
  const rules = document.createElement("dl");
  rules.className = "funding-card__rules";
  appendFact(rules, "Financiación", call.fundingRate);
  appendFact(rules, "Costes indirectos", call.indirectCosts);
  appendFact(rules, "Calendario", call.calendar);
  const warning = document.createElement("p");
  warning.className = "funding-card__critical";
  const warningLabel = document.createElement("strong");
  warningLabel.textContent = "Filtro decisivo: ";
  warning.append(warningLabel, document.createTextNode(call.critical));
  detailBody.append(rules, warning, createTraceability(call));
  details.append(summary, detailBody);

  const footer = document.createElement("footer");
  footer.className = "funding-card__footer";
  const actions = document.createElement("div");
  actions.className = "funding-card__actions";
  const plan = document.createElement("button");
  plan.type = "button";
  plan.className = "control control--primary";
  plan.dataset.planFunding = call.id;
  plan.textContent = "Preparar candidatura";
  const compare = document.createElement("label");
  compare.className = "funding-compare-check";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = call.id;
  checkbox.checked = state.selected.includes(call.id);
  checkbox.disabled = state.selected.length >= 3 && !checkbox.checked;
  checkbox.setAttribute("aria-label", `Comparar ${call.name}`);
  const compareText = document.createElement("span");
  compareText.textContent = checkbox.checked ? "Incluida en comparación" : "Añadir a comparación";
  compare.append(checkbox, compareText);
  const source = document.createElement("a");
  source.href = call.source.url;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = "Abrir fuente oficial";
  actions.append(plan, source);
  footer.append(compare, actions);

  article.append(header, facts, details, footer);
  return article;
}

function createTraceability(call) {
  const trace = document.createElement("section");
  trace.className = "funding-trace";
  const title = document.createElement("h5");
  title.textContent = "Trazabilidad del dato";
  const status = getTraceabilityStatus(call);
  const tags = document.createElement("div");
  tags.className = "funding-trace__tags";
  tags.append(createTag(status.label, status.id), createTag(TRACEABILITY_LABELS[call.stability], "stability"));
  const facts = document.createElement("dl");
  appendFact(facts, "Edición de referencia", call.editionReference);
  appendFact(facts, "Verificada", formatIsoDate(call.verifiedOn));
  const source = document.createElement("a");
  source.href = call.source.url;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = call.source.label;
  trace.append(title, tags, facts, source);
  return trace;
}

function createTag(label, type) {
  const tag = document.createElement("span");
  tag.className = `funding-tag funding-tag--${type}`;
  tag.textContent = label;
  return tag;
}

function appendFact(list, term, description, wide = false) {
  const row = document.createElement("div");
  if (wide) row.className = "funding-fact--wide";
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = description;
  row.append(dt, dd);
  list.append(row);
}

function handleComparisonToggle(event, elements, calls, state, render) {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  const update = updateComparison(state.selected, checkbox.value, 3);
  state.selected = update.selection;
  state.limitMessage = update.reason === "limit" ? "Ya hay tres vías seleccionadas. Retira una antes de añadir otra." : "";
  render();
  if (!update.changed) elements.comparisonStatus.focus?.();
}

function renderComparison(elements, calls, state) {
  const selectedCalls = state.selected.map((id) => calls.find((call) => call.id === id)).filter(Boolean);
  elements.clearComparison.disabled = selectedCalls.length === 0;
  elements.comparisonStatus.textContent = state.limitMessage || comparisonMessage(selectedCalls.length);
  const fragment = document.createDocumentFragment();

  if (!selectedCalls.length) {
    const empty = document.createElement("div");
    empty.className = "funding-comparison__empty";
    empty.textContent = "Usa «Añadir a comparación» en las fichas. La selección permanece aunque cambies los filtros.";
    fragment.append(empty);
    elements.comparisonContent.replaceChildren(fragment);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "funding-comparison__table-wrap";
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", "Comparación horizontal de convocatorias");
  const table = document.createElement("table");
  table.className = "funding-comparison__table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const aspect = document.createElement("th");
  aspect.scope = "col";
  aspect.textContent = "Aspecto";
  headRow.append(aspect);
  selectedCalls.forEach((call) => {
    const th = document.createElement("th");
    th.scope = "col";
    const name = document.createElement("strong");
    name.textContent = call.shortName;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "funding-comparison__remove";
    remove.dataset.removeFunding = call.id;
    remove.textContent = "Retirar";
    remove.setAttribute("aria-label", `Retirar ${call.name} de la comparación`);
    th.append(name, remove);
    headRow.append(th);
  });
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  buildComparisonRows(selectedCalls).forEach((row) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = row.label;
    tr.append(th);
    row.values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(thead, tbody);
  wrap.append(table);

  const sources = document.createElement("div");
  sources.className = "funding-comparison__sources";
  const sourceTitle = document.createElement("strong");
  sourceTitle.textContent = "Fuentes oficiales";
  sources.append(sourceTitle);
  selectedCalls.forEach((call) => {
    const link = document.createElement("a");
    link.href = call.source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = call.shortName;
    sources.append(link);
  });
  fragment.append(wrap, sources);
  elements.comparisonContent.replaceChildren(fragment);
}

function comparisonMessage(count) {
  if (count === 0) return "Selecciona dos o tres convocatorias para compararlas.";
  if (count === 1) return "1 vía seleccionada. Añade otra para contrastarla.";
  return `${count} vías seleccionadas para comparar.`;
}

function describeActiveFilters(criteria) {
  const labels = [];
  if (criteria.query) labels.push(`texto: «${criteria.query}»`);
  if (criteria.level !== "all") labels.push(FUNDING_LEVELS[criteria.level]);
  if (criteria.purpose !== "all") labels.push(FUNDING_PURPOSES[criteria.purpose]);
  if (criteria.profile !== "all") labels.push(FUNDING_PROFILES[criteria.profile]);
  if (criteria.participation !== "all") labels.push(FUNDING_PARTICIPATION[criteria.participation]);
  if (criteria.beneficiary !== "all") labels.push(FUNDING_BENEFICIARIES[criteria.beneficiary]);
  if (criteria.trl !== "all") labels.push(`TRL ${criteria.trl}`);
  if (criteria.frequency !== "all") labels.push(FUNDING_FREQUENCIES[criteria.frequency]);
  return labels.length ? `Filtros activos: ${labels.join(" · ")}.` : "Sin filtros aplicados.";
}
