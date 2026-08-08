import operationsData from "./data/operations.json";
import {
  AREA_LABELS,
  buildIcsCalendar,
  filterProcedures,
  formatReviewedDate,
  recommendProcedures,
  validateOperationsData
} from "./operational-tools-model.js";

const MONTHS = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });

export function initOperationalTools(root) {
  if (!root) throw new Error("No se encontró el área de herramientas operativas.");
  const data = validateOperationsData(operationsData);
  const elements = getElements(root);
  assertElements(elements);

  populateAreaOptions(elements.procedureArea, true);
  populateAreaOptions(elements.cardArea, true);
  populateYears(elements.calendarYear);
  elements.reviewedDate.textContent = formatReviewedDate(data.reviewedOn);
  elements.procedureCount.textContent = String(data.procedures.length);
  elements.milestoneCount.textContent = String(data.milestones.length);

  renderWizardResults(elements, data.procedures, { area: "all", role: "all", moment: "all" });
  renderProcedureCards(elements, data.procedures);
  renderCalendar(elements, data.milestones);
  bindEvents(elements, data);
}

function getElements(root) {
  return {
    root,
    wizardForm: root.querySelector("#procedureWizardForm"),
    procedureArea: root.querySelector("#procedureArea"),
    procedureRole: root.querySelector("#procedureRole"),
    procedureMoment: root.querySelector("#procedureMoment"),
    wizardResults: root.querySelector("#wizardResults"),
    wizardStatus: root.querySelector("#wizardStatus"),
    cardArea: root.querySelector("#procedureCardArea"),
    cardSearch: root.querySelector("#procedureCardSearch"),
    cardList: root.querySelector("#procedureCardList"),
    cardStatus: root.querySelector("#procedureCardStatus"),
    calendarList: root.querySelector("#calendarList"),
    calendarYear: root.querySelector("#calendarYear"),
    calendarStatus: root.querySelector("#calendarStatus"),
    selectAll: root.querySelector("#calendarSelectAll"),
    selectNone: root.querySelector("#calendarSelectNone"),
    downloadCalendar: root.querySelector("#downloadCalendar"),
    printCalendar: root.querySelector("#printCalendar"),
    reviewedDate: root.querySelector("#operationsReviewedDate"),
    procedureCount: root.querySelector("#operationsProcedureCount"),
    milestoneCount: root.querySelector("#operationsMilestoneCount")
  };
}

function assertElements(elements) {
  const missing = Object.entries(elements).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan controles operativos: ${missing.join(", ")}`);
}

function bindEvents(elements, data) {
  elements.wizardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderWizardResults(elements, data.procedures, {
      area: elements.procedureArea.value,
      role: elements.procedureRole.value,
      moment: elements.procedureMoment.value
    });
  });

  const updateCards = () => renderProcedureCards(
    elements,
    filterProcedures(data.procedures, elements.cardArea.value, elements.cardSearch.value)
  );
  elements.cardArea.addEventListener("change", updateCards);
  elements.cardSearch.addEventListener("input", updateCards);

  elements.calendarList.addEventListener("change", () => updateCalendarStatus(elements));
  elements.selectAll.addEventListener("click", () => setCalendarSelection(elements, true));
  elements.selectNone.addEventListener("click", () => setCalendarSelection(elements, false));
  elements.downloadCalendar.addEventListener("click", () => downloadCalendar(elements, data.milestones));
  elements.printCalendar.addEventListener("click", () => printCalendar());
}

function populateAreaOptions(select, includeAll) {
  const fragment = document.createDocumentFragment();
  if (includeAll) fragment.append(createOption("all", "Cualquier ámbito"));
  Object.entries(AREA_LABELS).forEach(([value, label]) => fragment.append(createOption(value, label)));
  select.replaceChildren(fragment);
}

function populateYears(select) {
  const currentYear = new Date().getFullYear();
  const fragment = document.createDocumentFragment();
  for (let year = currentYear; year <= currentYear + 3; year += 1) fragment.append(createOption(String(year), String(year)));
  select.replaceChildren(fragment);
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderWizardResults(elements, procedures, criteria) {
  const recommendations = recommendProcedures(procedures, criteria, 4);
  const fragment = document.createDocumentFragment();
  recommendations.forEach((procedure, index) => fragment.append(createProcedureCard(procedure, index === 0)));
  elements.wizardResults.replaceChildren(fragment);
  const label = criteria.area === "all" ? "todos los ámbitos" : AREA_LABELS[criteria.area].toLocaleLowerCase("es");
  elements.wizardStatus.textContent = `${recommendations.length} fichas recomendadas para ${label}.`;
}

function renderProcedureCards(elements, procedures) {
  const fragment = document.createDocumentFragment();
  procedures.forEach((procedure) => fragment.append(createProcedureCard(procedure, false)));
  if (!procedures.length) {
    const empty = document.createElement("p");
    empty.className = "tool-empty";
    empty.textContent = "No hay fichas que coincidan. Prueba otro término o ámbito.";
    fragment.append(empty);
  }
  elements.cardList.replaceChildren(fragment);
  elements.cardStatus.textContent = `${procedures.length} ${procedures.length === 1 ? "ficha visible" : "fichas visibles"}.`;
}

function createProcedureCard(procedure, open) {
  const details = document.createElement("details");
  details.className = "procedure-card";
  details.dataset.area = procedure.area;
  details.open = open;

  const summary = document.createElement("summary");
  const summaryCopy = document.createElement("span");
  summaryCopy.className = "procedure-card__summary";
  const tags = document.createElement("span");
  tags.className = "procedure-card__tags";
  tags.append(createTag(AREA_LABELS[procedure.area], "area"), createTag(procedure.validity === "annual" ? "Comprobar convocatoria" : "Fuente comprobada", procedure.validity));
  const title = document.createElement("strong");
  title.textContent = procedure.title;
  const description = document.createElement("span");
  description.textContent = procedure.summary;
  summaryCopy.append(tags, title, description);
  const marker = document.createElement("span");
  marker.className = "procedure-card__marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "+";
  summary.append(summaryCopy, marker);

  const content = document.createElement("div");
  content.className = "procedure-card__content";
  const facts = document.createElement("dl");
  facts.className = "procedure-facts";
  appendFact(facts, "Unidad inicial", procedure.unit);
  appendFact(facts, "Plazo crítico", procedure.deadline);
  appendFact(facts, "Canal", procedure.channel);

  const lists = document.createElement("div");
  lists.className = "procedure-lists";
  lists.append(createList("Prepara", procedure.documents), createList("Secuencia mínima", procedure.steps, true));

  const risk = document.createElement("p");
  risk.className = "procedure-risk";
  const riskLabel = document.createElement("strong");
  riskLabel.textContent = "Evita este error: ";
  risk.append(riskLabel, document.createTextNode(procedure.risk));

  const footer = document.createElement("footer");
  footer.className = "procedure-card__footer";
  const chapterLink = document.createElement("a");
  chapterLink.href = `#${procedure.anchor}`;
  chapterLink.textContent = `Abrir capítulo ${procedure.chapter}`;
  const sourceLink = document.createElement("a");
  sourceLink.href = procedure.sourceUrl;
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.textContent = procedure.sourceLabel;
  footer.append(chapterLink, sourceLink);

  content.append(facts, lists, risk, footer);
  details.append(summary, content);
  return details;
}

function createTag(label, type) {
  const tag = document.createElement("span");
  tag.className = `procedure-tag procedure-tag--${type}`;
  tag.textContent = label;
  return tag;
}

function appendFact(list, term, description) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = description;
  row.append(dt, dd);
  list.append(row);
}

function createList(title, values, ordered = false) {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement(ordered ? "ol" : "ul");
  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
  section.append(heading, list);
  return section;
}

function renderCalendar(elements, milestones) {
  const fragment = document.createDocumentFragment();
  milestones.forEach((milestone) => {
    const label = document.createElement("label");
    label.className = "calendar-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "calendarMilestone";
    checkbox.value = milestone.id;
    checkbox.checked = true;
    const date = document.createElement("span");
    date.className = "calendar-item__date";
    date.textContent = `${String(milestone.day).padStart(2, "0")} ${MONTHS.format(new Date(Date.UTC(2026, milestone.month - 1, 1))).replace(".", "")}`;
    const copy = document.createElement("span");
    copy.className = "calendar-item__copy";
    const title = document.createElement("strong");
    title.textContent = milestone.title;
    const description = document.createElement("span");
    description.textContent = milestone.description;
    const chapter = document.createElement("a");
    chapter.href = `#${milestone.anchor}`;
    chapter.textContent = `Capítulo ${milestone.chapter}`;
    chapter.addEventListener("click", (event) => event.stopPropagation());
    copy.append(title, description, chapter);
    label.append(checkbox, date, copy);
    fragment.append(label);
  });
  elements.calendarList.replaceChildren(fragment);
  updateCalendarStatus(elements);
}

function setCalendarSelection(elements, selected) {
  elements.calendarList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => { checkbox.checked = selected; });
  updateCalendarStatus(elements);
}

function updateCalendarStatus(elements) {
  const total = elements.calendarList.querySelectorAll('input[type="checkbox"]').length;
  const selected = elements.calendarList.querySelectorAll('input[type="checkbox"]:checked').length;
  elements.calendarStatus.textContent = `${selected} de ${total} recordatorios seleccionados.`;
  elements.downloadCalendar.disabled = selected === 0;
}

function downloadCalendar(elements, milestones) {
  const selectedIds = new Set([...elements.calendarList.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value));
  const selected = milestones.filter((milestone) => selectedIds.has(milestone.id));
  const year = Number(elements.calendarYear.value);
  const content = buildIcsCalendar(selected, year, window.location.href);
  const blobUrl = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `guia-operativa-uv-${year}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
  elements.calendarStatus.textContent = `Calendario ${year} descargado con ${selected.length} recordatorios orientativos.`;
}

function printCalendar() {
  const cleanup = () => document.body.classList.remove("print-calendar");
  document.body.classList.add("print-calendar");
  window.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 1000);
}
