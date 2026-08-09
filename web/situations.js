import manualData from "./data/manual.json";
import operationsData from "./data/operations.json";
import situationsData from "./data/situations.json";
import situationsExtensionData from "./data/situations-51-100.json";
import situationsSpecialisedData from "./data/situations-101-104.json";
import academicContextData from "./data/academic-situation-context.json";
import academicProgrammesData from "./data/academic-programmes.json";
import personalResearchData from "./data/personal-research-context.json";
import { buildExampleGuides } from "./example-guide-model.js";
import { buildSituationGuides, combineSituationCatalogs, searchSituationGuides, situationSearchItems } from "./situation-model.js";

export const situationCatalog = combineSituationCatalogs(situationsData, situationsExtensionData, situationsSpecialisedData);
const academicProgrammeById = new Map(academicProgrammesData.programmes.map((programme) => [programme.id, programme]));
const researchStageById = new Map(personalResearchData.stages.map((stage) => [stage.id, stage]));

export const situationGuides = buildSituationGuides(
  situationCatalog,
  buildExampleGuides(manualData.markdown, operationsData.procedures),
  academicContextData,
  personalResearchData
);

export function situationGlobalSearchItems() {
  return situationSearchItems(situationGuides);
}

export function initSituationDirectory(root, options = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError("Falta la sección de situaciones.");
  const elements = {
    query: root.querySelector("#situationQuery"), category: root.querySelector("#situationCategory"), clear: root.querySelector("#situationClear"),
    status: root.querySelector("#situationStatus"), list: root.querySelector("#situationList"), count: root.querySelector("#situationCount")
  };
  const missing = Object.entries(elements).filter(([, element]) => !element).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan controles de situaciones: ${missing.join(", ")}.`);

  const pageSize = Number.isInteger(options.pageSize) && options.pageSize > 0 ? options.pageSize : 8;
  const loadMore = document.createElement("button");
  loadMore.className = "control situation-load-more";
  loadMore.type = "button";
  loadMore.setAttribute("aria-controls", elements.list.id);
  elements.list.after(loadMore);
  const state = { query: "", category: "all", visibleLimit: pageSize };
  populateCategories(elements.category);
  elements.count.textContent = String(situationGuides.length);
  bindEvents();
  render();
  return Object.freeze({ count: situationGuides.length });

  function bindEvents() {
    elements.query.addEventListener("input", () => { state.query = elements.query.value; state.visibleLimit = pageSize; render(); });
    elements.category.addEventListener("change", () => { state.category = elements.category.value; state.visibleLimit = pageSize; render(); });
    elements.clear.addEventListener("click", () => {
      state.query = ""; state.category = "all"; state.visibleLimit = pageSize; elements.query.value = ""; elements.category.value = "all"; render(); elements.query.focus();
    });
    loadMore.addEventListener("click", () => { state.visibleLimit += pageSize; render(); });
  }

  function render() {
    const guides = searchSituationGuides(situationGuides, state.query, state.category);
    const visibleGuides = guides.slice(0, state.visibleLimit);
    const fragment = document.createDocumentFragment();
    visibleGuides.forEach((guide) => fragment.append(renderCard(guide, options.detailBase ?? "example.html")));
    if (!guides.length) fragment.append(renderEmpty());
    elements.list.replaceChildren(fragment);
    elements.status.textContent = guides.length === 1
      ? `1 situación visible · ${situationGuides.length} totales.`
      : `${visibleGuides.length} mostradas de ${guides.length} coincidencias · ${situationGuides.length} totales.`;
    const remaining = guides.length - visibleGuides.length;
    loadMore.hidden = remaining <= 0;
    loadMore.textContent = remaining > 0 ? `Mostrar ${Math.min(pageSize, remaining)} más` : "";
    elements.clear.disabled = !state.query && state.category === "all";
  }
}

function renderCard(guide, detailBase) {
  const article = document.createElement("article");
  article.className = "situation-card";
  article.id = `situacion-${guide.id}`;
  const header = document.createElement("header");
  const number = document.createElement("span");
  number.className = "situation-card__number";
  number.textContent = String(guide.situationNumber).padStart(2, "0");
  const heading = document.createElement("div");
  const category = document.createElement("p");
  category.className = "situation-card__category";
  category.textContent = guide.categoryLabel;
  const title = document.createElement("h3");
  title.textContent = guide.title;
  heading.append(category, title);
  header.append(number, heading);
  const scenario = document.createElement("p");
  scenario.className = "situation-card__scenario";
  scenario.textContent = guide.scenario;
  const firstMove = document.createElement("p");
  firstMove.className = "situation-card__first-move";
  const firstMoveLabel = document.createElement("strong");
  firstMoveLabel.textContent = "Empieza por";
  firstMove.append(firstMoveLabel, document.createTextNode(` ${guide.firstMove}`));
  const programmes = renderProgrammeTags(guide.academicContext?.programmeIds ?? []);
  const researchStages = renderResearchTags(guide.personalResearchContext);
  const link = document.createElement("a");
  link.className = "situation-card__open";
  link.href = `${detailBase}?caso=${encodeURIComponent(guide.id)}`;
  link.textContent = "Abrir resolución paso a paso";
  article.append(header, scenario, firstMove);
  if (programmes) article.append(programmes);
  if (researchStages) article.append(researchStages);
  article.append(link);
  return article;
}

function renderResearchTags(context) {
  if (!context) return null;
  const container = document.createElement("div");
  container.className = "research-tags";
  container.setAttribute("aria-label", "Aplicación al ciclo de investigación ICMUV");
  const contextTag = document.createElement("span");
  contextTag.className = `research-tag research-tag--${context.fit}`;
  contextTag.textContent = context.fit === "conditional" ? "ICMUV · condicional" : "ICMUV";
  container.append(contextTag);
  context.stages.slice(0, 3).forEach((id) => {
    const stage = researchStageById.get(id);
    if (!stage) return;
    const tag = document.createElement("span");
    tag.className = "research-tag";
    tag.textContent = stage.label;
    container.append(tag);
  });
  return container;
}

function renderProgrammeTags(programmeIds) {
  if (!programmeIds.length) return null;
  const container = document.createElement("div");
  container.className = "academic-tags";
  container.setAttribute("aria-label", "Titulaciones contextualizadas");
  programmeIds.forEach((id) => {
    const programme = academicProgrammeById.get(id);
    if (!programme) return;
    const tag = document.createElement("span");
    tag.className = "academic-tag";
    tag.textContent = programme.acronym;
    tag.title = programme.name;
    container.append(tag);
  });
  return container.childElementCount ? container : null;
}

function renderEmpty() {
  const empty = document.createElement("div");
  empty.className = "situation-empty";
  const heading = document.createElement("h3");
  heading.textContent = "No hay una coincidencia directa";
  const text = document.createElement("p");
  text.textContent = "Prueba con el objetivo, una sigla, la unidad o una acción. El buscador general también localiza capítulos, trámites y términos relacionados.";
  empty.append(heading, text);
  return empty;
}

function populateCategories(select) {
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Todos los ámbitos";
  select.append(all);
  situationCatalog.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.label;
    select.append(option);
  });
}
