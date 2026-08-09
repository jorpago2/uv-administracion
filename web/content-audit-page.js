import "./site-shell.js";
import auditConfig from "./data/content-audit.json";
import { situationCatalog, situationGuides } from "./situations.js";
import { buildContentAudit, filterContentAudit, summarizeContentAudit } from "./content-audit-model.js";

const assessments = buildContentAudit(situationGuides, situationCatalog.situations, auditConfig);
const summary = summarizeContentAudit(assessments, auditConfig);
const guideById = new Map(situationGuides.map((guide) => [guide.id, guide]));
const PAGE_SIZE = 8;
const state = { query: "", status: "all", category: "all", priority: "all", visibleLimit: PAGE_SIZE };

const elements = {
  reviewedOn: required("#auditReviewedOn"), scope: required("#auditScope"), stats: required("#auditStats"),
  statusKey: required("#auditStatusKey"), methodology: required("#auditMethodology"), institutionMap: required("#institutionMap"),
  missingCount: required("#missingCount"), gapList: required("#auditGapList"), filters: required("#auditFilters"),
  query: required("#auditQuery"), status: required("#auditStatus"), category: required("#auditCategory"),
  priority: required("#auditPriority"), clear: required("#auditClear"), resultStatus: required("#auditResultStatus"),
  caseList: required("#auditCaseList"), loadMore: required("#auditLoadMore")
};

renderOverview();
renderInstitutionMap();
renderGaps();
populateFilters();
bindFilters();
renderCases();

function renderOverview() {
  elements.reviewedOn.dateTime = auditConfig.reviewedOn;
  elements.reviewedOn.textContent = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(`${auditConfig.reviewedOn}T12:00:00`));
  elements.scope.textContent = auditConfig.scope;
  const stats = [
    ["Casos auditados", summary.total], ["Prioridad alta", summary.highPriority],
    ["Una sola fuente", summary.weakSourceSupport], ["Menos de 4 pasos", summary.shortRoutes],
    ["Huecos detectados", summary.missing]
  ];
  elements.stats.replaceChildren(...stats.map(([label, value]) => definition(label, value)));
  elements.statusKey.replaceChildren(...auditConfig.statuses.map((status) => {
    const article = document.createElement("article");
    article.className = `audit-status-card audit-status-card--${status.id}`;
    const count = document.createElement("strong");
    count.textContent = String(summary.counts[status.id]);
    const heading = document.createElement("h3");
    heading.textContent = status.label;
    const text = document.createElement("p");
    text.textContent = status.description;
    article.append(count, heading, text);
    return article;
  }));
  elements.methodology.replaceChildren(...auditConfig.methodology.map((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
}

function renderInstitutionMap() {
  elements.institutionMap.replaceChildren(...auditConfig.institutionMap.map((unit) => {
    const article = document.createElement("article");
    const header = document.createElement("header");
    const name = document.createElement("h3");
    name.textContent = unit.name;
    const role = document.createElement("span");
    role.textContent = unit.role;
    header.append(name, role);
    const start = paragraphWithLabel("Empieza aquí: ", unit.startHere);
    const boundary = paragraphWithLabel("Límite: ", unit.boundary);
    boundary.className = "institution-boundary";
    const link = document.createElement("a");
    link.href = unit.source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = unit.source.label;
    article.append(header, start, boundary, link);
    return article;
  }));
}

function renderGaps() {
  elements.missingCount.textContent = String(auditConfig.missingCases.length);
  elements.gapList.replaceChildren(...auditConfig.missingCases.map((gap, index) => {
    const article = document.createElement("article");
    article.className = "audit-gap";
    const number = document.createElement("span");
    number.className = "audit-gap__number";
    number.textContent = `F${String(index + 1).padStart(2, "0")}`;
    const body = document.createElement("div");
    const meta = document.createElement("p");
    meta.className = `audit-priority audit-priority--${gap.priority}`;
    meta.textContent = `Prioridad ${gap.priority}`;
    const title = document.createElement("h3");
    title.textContent = gap.title;
    const reason = document.createElement("p");
    reason.textContent = gap.reason;
    const nearbyLabel = document.createElement("strong");
    nearbyLabel.textContent = "Cobertura parcial existente";
    const nearby = document.createElement("div");
    nearby.className = "audit-nearby";
    gap.nearbySituationIds.forEach((id) => {
      const guide = guideById.get(id);
      if (!guide) return;
      const link = document.createElement("a");
      link.href = `../example.html?caso=${encodeURIComponent(id)}`;
      link.textContent = `${String(guide.situationNumber).padStart(2, "0")} · ${guide.title}`;
      nearby.append(link);
    });
    body.append(meta, title, reason, nearbyLabel, nearby);
    article.append(number, body);
    return article;
  }));
}

function populateFilters() {
  auditConfig.statuses.forEach((status) => elements.status.append(option(status.id, status.label)));
  situationCatalog.categories.forEach((category) => elements.category.append(option(category.id, category.label)));
}

function bindFilters() {
  elements.filters.addEventListener("submit", (event) => event.preventDefault());
  for (const [key, element] of [["query", elements.query], ["status", elements.status], ["category", elements.category], ["priority", elements.priority]]) {
    element.addEventListener(element.tagName === "INPUT" ? "input" : "change", () => {
      state[key] = element.value;
      state.visibleLimit = PAGE_SIZE;
      renderCases();
    });
  }
  elements.clear.addEventListener("click", () => {
    Object.assign(state, { query: "", status: "all", category: "all", priority: "all", visibleLimit: PAGE_SIZE });
    elements.query.value = "";
    elements.status.value = "all";
    elements.category.value = "all";
    elements.priority.value = "all";
    renderCases();
    elements.query.focus();
  });
  elements.loadMore.addEventListener("click", () => {
    state.visibleLimit += PAGE_SIZE;
    renderCases();
  });
}

function renderCases() {
  const matches = filterContentAudit(assessments, state);
  const visible = matches.slice(0, state.visibleLimit);
  elements.caseList.replaceChildren(...visible.map((assessment) => {
    const article = document.createElement("article");
    article.className = `audit-case audit-case--${assessment.statusId}`;
    const number = document.createElement("span");
    number.className = "audit-case__number";
    number.textContent = String(assessment.number).padStart(2, "0");
    const body = document.createElement("div");
    const tags = document.createElement("div");
    tags.className = "audit-case__tags";
    tags.append(tag(assessment.statusLabel, `audit-tag audit-tag--${assessment.statusId}`));
    tags.append(tag(assessment.categoryLabel, "audit-tag"));
    if (assessment.priority !== "normal") tags.append(tag(`Prioridad ${assessment.priority}`, `audit-tag audit-tag--priority-${assessment.priority}`));
    const title = document.createElement("h3");
    title.textContent = assessment.title;
    const rationale = document.createElement("p");
    rationale.textContent = assessment.rationale;
    const action = paragraphWithLabel("Siguiente mejora: ", assessment.nextAction);
    action.className = "audit-case__action";
    const metrics = document.createElement("dl");
    metrics.className = "audit-case__metrics";
    metrics.append(
      definition("Fuentes", assessment.metrics.sources), definition("Pasos", assessment.metrics.steps),
      definition("Documentos", assessment.metrics.documents), definition("Evidencias", assessment.metrics.completionEvidence)
    );
    body.append(tags, title, rationale, action, metrics);
    const link = document.createElement("a");
    link.className = "audit-case__open";
    link.href = `../example.html?caso=${encodeURIComponent(assessment.id)}`;
    link.textContent = "Revisar resolución";
    article.append(number, body, link);
    return article;
  }));
  elements.resultStatus.textContent = matches.length === 1
    ? `1 caso visible · ${assessments.length} totales.`
    : `${visible.length} mostrados de ${matches.length} coincidencias · ${assessments.length} totales.`;
  const remaining = matches.length - visible.length;
  elements.loadMore.hidden = remaining <= 0;
  elements.loadMore.textContent = remaining > 0 ? `Mostrar ${Math.min(PAGE_SIZE, remaining)} más` : "";
  elements.clear.disabled = !state.query && state.status === "all" && state.category === "all" && state.priority === "all";
}

function definition(label, value) {
  const wrapper = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = String(value);
  wrapper.append(term, description);
  return wrapper;
}

function paragraphWithLabel(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = label;
  paragraph.append(strong, document.createTextNode(value));
  return paragraph;
}

function tag(text, className) {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  return element;
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function required(selector) {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Falta el elemento requerido ${selector}.`);
  return element;
}
