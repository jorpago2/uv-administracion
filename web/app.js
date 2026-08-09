import manualData from "./data/manual.json";
import decisionCasesData from "./data/decision-cases.json";
import fundingCallsData from "./data/funding-calls.json";
import operationsData from "./data/operations.json";
import { CATEGORIES } from "./chapter-categories.js";
import { NAV_LANDMARKS, pickCurrentNavigationItem } from "./navigation-model.js";
import {
  createSearchSnippet,
  matchesSearchQuery,
  prepareSearchEntry,
  rankSearchEntries,
  tokenizeSearchQuery
} from "./search-model.js";
import { initDecisionTools } from "./decision-tools.js";
import { initFundingExplorer } from "./funding-explorer.js";
import { initFundingPlanner } from "./funding-planner.js";
import { initOperationalTools } from "./operational-tools.js";
import { initProjectBudget } from "./project-budget.js";
import { initSalaryCalculator } from "./salary-calculator.js";

const FILTER_MAP = Object.freeze({
  all: null,
  ...Object.fromEntries(CATEGORIES.map((category) => [category.id, new Set(category.sections)]))
});

const state = {
  sections: [], searchEntries: [], searchResults: [], visibleChapterCount: 0,
  activeFilter: "all", query: "", searchTimer: null,
  indexExpandedAll: false, indexFollowActive: true,
  activeNavigationId: "", scrollSpyFrame: null, scrollSpyBound: false
};
const desktopMenuMedia = window.matchMedia("(min-width: 60rem)");
const elements = {
  manual: document.querySelector("#manual"),
  index: document.querySelector("#chapterIndex"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  searchControl: document.querySelector("#searchControl"),
  clearSearch: document.querySelector("#clearSearch"),
  searchStatus: document.querySelector("#searchStatus"),
  searchSuggestions: document.querySelector("#searchSuggestions"),
  searchResults: document.querySelector("#searchResults"),
  revisionDate: document.querySelector("#revisionDate"),
  sectionCount: document.querySelector("#sectionCount"),
  linkCount: document.querySelector("#linkCount"),
  exampleCount: document.querySelector("#exampleCount"),
  indexPanel: document.querySelector("#indexPanel"),
  menuButton: document.querySelector("#menuButton"),
  closeMenuButton: document.querySelector("#closeMenuButton"),
  menuScrim: document.querySelector("#menuScrim"),
  pageShell: document.querySelector(".page-shell"),
  filters: document.querySelector(".filters"),
  domainDirectory: document.querySelector("#domainDirectory"),
  chapterFilterArea: document.querySelector("#indice-capitulos"),
  backToTop: document.querySelector("#backToTop"),
  operationalHub: document.querySelector("#herramientas-operativas")
};

assertRequiredElements(elements);
bindEvents();
syncMenuMode();
initOperationalTools(elements.operationalHub);
initFundingExplorer(document.querySelector("#explorador-financiacion"));
initFundingPlanner(document.querySelector("#explorador-financiacion"));
initDecisionTools(document.querySelector("#calculadoras-operativas"));
initProjectBudget(document.querySelector("#calculadora-presupuesto"));
initSalaryCalculator(document.querySelector("#salaryCalculator"));
loadManual();

function assertRequiredElements(nodes) {
  const missing = Object.entries(nodes).filter(([, node]) => !node).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan elementos requeridos: ${missing.join(", ")}`);
}

async function loadManual() {
  setSearchState("loading");
  try {
    const data = manualData;
    validateManualData(data);
    const parsed = parseManual(data.markdown);
    state.sections = parsed.sections;
    state.searchEntries = buildSearchEntries(parsed.sections);
    renderMetadata(data.meta, parsed.sections.length, countLinks(data.markdown), countExamples(data.markdown));
    renderIntroduction(parsed.introduction);
    renderSections(parsed.sections);
    renderDomainDirectory(parsed.sections);
    renderIndex(parsed.sections);
    state.visibleChapterCount = parsed.sections.length;
    renderSearchResults();
    updateSearchStatus();
    setSearchState("success");
    elements.manual.dataset.state = "success";
    elements.manual.setAttribute("aria-busy", "false");
    setupScrollSpy();
    applyHashFocus();
  } catch (error) {
    setSearchState("error");
    elements.manual.dataset.state = "error";
    elements.manual.setAttribute("aria-busy", "false");
    renderLoadError(error);
  }
}

function validateManualData(data) {
  if (!data || data.schemaVersion !== 1 || typeof data.markdown !== "string" || !data.meta) {
    throw new Error("El archivo de datos no tiene el formato esperado.");
  }
  if (data.markdown.trim().length < 100) throw new Error("El manual cargado está vacío o incompleto.");
}

function parseManual(markdown) {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  const matches = [...normalized.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  if (!matches.length) throw new Error("No se encontraron capítulos numerados en el manual.");
  const introduction = normalized.slice(0, matches[0].index).replace(/^#\s+.+$/m, "").trim();
  const sections = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length;
    const number = Number(match[1]);
    const title = match[2].trim();
    const body = normalized.slice(start, end).trim();
    const category = getCategory(number);
    return {
      number,
      title,
      slug: slugify(title),
      body,
      categoryId: category.id,
      categoryLabel: category.label,
      searchText: normalizeText(`${category.label} ${title} ${stripMarkdown(body)}`)
    };
  });
  return { introduction, sections };
}

function buildSearchEntries(sections) {
  const chapters = sections.map((section) => prepareSearchEntry({
    id: `chapter-${section.number}`,
    type: "chapter",
    typeLabel: `Capítulo ${section.number}`,
    title: section.title,
    category: section.categoryLabel,
    content: stripMarkdown(section.body),
    href: `#${section.slug}`,
    chapterNumber: section.number,
    priority: 20
  }));

  const examples = sections.flatMap((section) => {
    const match = section.body.match(/^>\s+\*\*Ejemplo realista\s*[—-]\s*(.+?)\.\*\*\s+(.+)$/m);
    if (!match) return [];
    return [prepareSearchEntry({
      id: `example-${section.number}`,
      type: "guide",
      typeLabel: "Guía paso a paso",
      title: match[1],
      category: section.categoryLabel,
      content: match[2],
      href: `example.html?capitulo=${section.number}`,
      chapterNumber: section.number,
      priority: 30
    })];
  });

  const procedures = operationsData.procedures.map((procedure) => prepareSearchEntry({
    id: `procedure-${procedure.id}`,
    type: "procedure",
    typeLabel: "Trámite",
    title: procedure.title,
    category: categoryLabelFor(procedure.area),
    keywords: `${procedure.unit} ${procedure.channel} ${procedure.sourceLabel}`,
    content: [procedure.summary, procedure.deadline, procedure.risk, ...(procedure.documents ?? []), ...(procedure.steps ?? [])].join(" "),
    href: procedure.anchor ? `#${procedure.anchor}` : "#fichas-procedimiento",
    chapterNumber: procedure.chapter,
    priority: 25
  }));

  const fundingCalls = fundingCallsData.calls.map((call) => prepareSearchEntry({
    id: `funding-${call.id}`,
    type: "funding",
    typeLabel: "Convocatoria",
    title: call.name,
    category: fundingLevelLabel(call.level),
    keywords: `${call.shortName} ${(call.purposes ?? []).join(" ")} ${(call.profiles ?? []).join(" ")}`,
    content: [call.profile, call.participation, call.duration, call.budget, call.frequency, call.calendar, call.critical].join(" "),
    href: "#explorador-financiacion",
    queryValue: call.shortName || call.name,
    priority: 15
  }));

  const cases = decisionCasesData.cases.map((item) => prepareSearchEntry({
    id: `case-${item.id}`,
    type: "case",
    typeLabel: "Caso práctico",
    title: item.title,
    category: item.area,
    content: [item.summary, ...(item.facts ?? []), ...(item.decision ?? []), ...(item.mistakes ?? []), item.result].join(" "),
    href: "#casos-completos",
    priority: 10
  }));

  const tools = NAV_LANDMARKS
    .filter((item) => !["inicio", "tareas-frecuentes", "ambitos", "indice-capitulos"].includes(item.id))
    .map((item) => prepareSearchEntry({
      id: `tool-${item.id}`,
      type: "tool",
      typeLabel: item.typeLabel,
      title: item.label,
      category: categoryLabelFor(item.categoryId),
      keywords: item.parentId === item.id ? "" : NAV_LANDMARKS.find((candidate) => candidate.id === item.parentId)?.label,
      content: "",
      href: `#${item.id}`,
      priority: 35
    }));

  return [...chapters, ...examples, ...procedures, ...tools, ...fundingCalls, ...cases];
}

function categoryLabelFor(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId)?.shortLabel ?? "Guía operativa";
}

function fundingLevelLabel(level) {
  return ({ european: "Financiación europea", national: "Financiación estatal", regional: "Financiación autonómica", uv: "Financiación UV", private: "Financiación privada" })[level]
    ?? "Financiación I+D+i";
}

function renderMetadata(meta, sectionTotal, linkTotal, exampleTotal) {
  const rawDate = typeof meta.fecha_revision === "string" ? meta.fecha_revision : "";
  elements.revisionDate.textContent = formatDate(rawDate);
  elements.sectionCount.textContent = String(sectionTotal);
  elements.linkCount.textContent = String(linkTotal);
  elements.exampleCount.textContent = String(exampleTotal);
}

function renderIntroduction(markdown) {
  elements.manual.replaceChildren();
  if (!markdown) return;
  const introduction = document.createElement("div");
  introduction.className = "manual-introduction";
  introduction.innerHTML = renderMarkdown(markdown);
  elements.manual.append(introduction);
}

function renderSections(sections) {
  const fragment = document.createDocumentFragment();
  sections.forEach((section) => {
    const article = document.createElement("article");
    article.className = "chapter";
    article.id = section.slug;
    article.dataset.section = String(section.number);
    article.dataset.category = section.categoryId;
    article.dataset.searchText = section.searchText;

    const header = document.createElement("header");
    header.className = "chapter__head";
    const titleBlock = document.createElement("div");
    titleBlock.className = "chapter__title-block";
    const category = document.createElement("p");
    category.className = "chapter__category";
    category.textContent = section.categoryLabel;
    const title = document.createElement("h2");
    title.textContent = section.title;
    const copyButton = document.createElement("button");
    copyButton.className = "copy-link";
    copyButton.type = "button";
    copyButton.dataset.copyTarget = section.slug;
    copyButton.dataset.state = "default";
    copyButton.textContent = "Copiar enlace";
    copyButton.setAttribute("aria-label", `Copiar enlace al capítulo ${section.number}: ${section.title}`);
    const body = document.createElement("div");
    body.className = "chapter__body";
    body.innerHTML = renderMarkdown(section.body, section.number);
    titleBlock.append(category, title);
    header.append(titleBlock, copyButton);
    article.append(header, body);
    fragment.append(article);
  });
  elements.manual.append(fragment);
}

function renderDomainDirectory(sections) {
  const fragment = document.createDocumentFragment();
  CATEGORIES.forEach((category, index) => {
    const card = document.createElement("article");
    card.className = "domain-card";
    card.id = `ambito-${category.id}`;

    const heading = document.createElement("header");
    const number = document.createElement("span");
    number.className = "domain-card__number";
    number.textContent = String(index + 1).padStart(2, "0");
    const titleBlock = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = category.shortLabel;
    const summary = document.createElement("p");
    summary.textContent = category.summary;
    titleBlock.append(title, summary);
    heading.append(number, titleBlock);

    const columns = document.createElement("div");
    columns.className = "domain-card__columns";
    columns.append(
      domainLinkGroup("Trámites destacados", category.featuredSections.map((number) => {
        const section = sections.find((candidate) => candidate.number === number);
        return { label: section?.title ?? `Capítulo ${number}`, href: section ? `#${section.slug}` : "#indice-capitulos" };
      })),
      domainLinkGroup("Herramientas", category.tools)
    );

    const footer = document.createElement("footer");
    const open = document.createElement("a");
    open.className = "domain-card__open";
    open.href = "#indice-capitulos";
    open.dataset.domainTarget = category.id;
    open.textContent = `Ver ${category.sections.length} capítulos`;
    const count = document.createElement("span");
    count.textContent = `${category.tools.length} ${category.tools.length === 1 ? "herramienta" : "herramientas"}`;
    footer.append(open, count);
    card.append(heading, columns, footer);
    fragment.append(card);
  });
  elements.domainDirectory.replaceChildren(fragment);
}

function domainLinkGroup(title, links) {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const list = document.createElement("ul");
  links.forEach(({ label, href }) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    item.append(link);
    list.append(item);
  });
  section.append(heading, list);
  return section;
}

function renderIndex(sections) {
  const fragment = document.createDocumentFragment();
  const location = document.createElement("div");
  location.className = "index-location";
  location.setAttribute("aria-label", "Ubicación actual");
  const locationLabel = document.createElement("span");
  locationLabel.className = "index-location__label";
  locationLabel.textContent = "Ahora estás en";
  const locationLink = document.createElement("a");
  locationLink.id = "indexCurrentLink";
  locationLink.href = "#inicio";
  locationLink.textContent = "Inicio";
  locationLink.setAttribute("aria-current", "location");
  const locationContext = document.createElement("span");
  locationContext.className = "index-location__context";
  locationContext.id = "indexCurrentContext";
  locationContext.textContent = "Portada";
  location.append(locationLabel, locationLink, locationContext);
  fragment.append(location);

  const shortcuts = document.createElement("div");
  shortcuts.className = "index-shortcuts";
  NAV_LANDMARKS.filter((item) => item.shortcut).forEach(({ id, label }) => {
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.dataset.indexAnchor = id;
    link.textContent = label;
    shortcuts.append(link);
  });
  fragment.append(shortcuts);

  const toggle = document.createElement("button");
  toggle.className = "index-all-toggle";
  toggle.id = "indexAllToggle";
  toggle.type = "button";
  toggle.textContent = "Ver índice completo";
  fragment.append(toggle);

  CATEGORIES.forEach((category) => {
    const categorySections = sections.filter((section) => section.categoryId === category.id);
    if (!categorySections.length) return;
    const group = document.createElement("details");
    group.className = "index-group";
    group.dataset.indexCategory = category.id;
    const heading = document.createElement("summary");
    const headingLabel = document.createElement("span");
    headingLabel.textContent = category.shortLabel;
    const headingCount = document.createElement("span");
    headingCount.textContent = String(categorySections.length).padStart(2, "0");
    heading.append(headingLabel, headingCount);
    const list = document.createElement("ol");
    list.className = "index-list";
    categorySections.forEach((section) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${section.slug}`;
      link.dataset.indexSection = String(section.number);
      const number = document.createElement("span");
      number.className = "index-list__number";
      number.textContent = String(section.number).padStart(2, "0");
      const title = document.createElement("span");
      title.className = "index-list__title";
      title.textContent = section.title;
      link.append(number, title);
      item.append(link);
      list.append(item);
    });
    group.append(heading, list);
    group.addEventListener("toggle", (event) => {
      if (!group.open) {
        state.indexExpandedAll = false;
        updateIndexToggleLabel();
        return;
      }
      if (event.isTrusted) state.indexFollowActive = true;
      if (state.indexExpandedAll) return;
      elements.index.querySelectorAll(".index-group[open]").forEach((candidate) => {
        if (candidate !== group) candidate.open = false;
      });
      updateIndexToggleLabel();
    });
    fragment.append(group);
  });
  elements.index.replaceChildren(fragment);
}

function renderMarkdown(markdown, chapterNumber = null) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{3,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (line.startsWith("|")) {
      const tableLines = [];
      while (index < lines.length && lines[index].startsWith("|")) { tableLines.push(lines[index]); index += 1; }
      html.push(renderTable(tableLines));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) { items.push(lines[index].replace(/^[-*]\s+/, "")); index += 1; }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) { items.push(lines[index].replace(/^\d+\.\s+/, "")); index += 1; }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) { quote.push(lines[index].replace(/^>\s?/, "")); index += 1; }
      const quoteText = quote.join(" ");
      const isExample = /^\*\*Ejemplo realista\b/.test(quoteText);
      const className = isExample ? " class=\"case-example\"" : "";
      const detailLink = isExample && Number.isInteger(chapterNumber)
        ? `<a class="case-example__open" href="example.html?capitulo=${chapterNumber}">Abrir guía detallada paso a paso</a>`
        : "";
      html.push(`<blockquote${className}>${renderInline(quoteText)}${detailLink}</blockquote>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) { html.push("<hr>"); index += 1; continue; }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) { paragraph.push(lines[index].trim()); index += 1; }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }
  return html.join("");
}

function isBlockStart(line) { return /^(#{3,4})\s+|^\||^[-*]\s+|^\d+\.\s+|^>\s?|^---+$/.test(line); }

function renderTable(lines) {
  if (lines.length < 2) return `<p>${renderInline(lines.join(" "))}</p>`;
  const rows = lines.map(splitTableRow);
  const hasSeparator = rows[1].every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  if (!hasSeparator) return `<p>${renderInline(lines.join(" "))}</p>`;
  const headers = rows[0];
  const bodyRows = rows.slice(2);
  const head = `<thead><tr>${headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${bodyRows.map((row) => `<tr>${headers.map((_, column) => `<td>${renderInline(row[column] || "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table>${head}${body}</table></div>`;
}

function splitTableRow(line) { return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()); }

function renderInline(source) {
  const tokenPattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let output = "";
  let cursor = 0;
  for (const match of source.matchAll(tokenPattern)) {
    output += escapeHtml(source.slice(cursor, match.index));
    if (match[2] !== undefined) {
      const href = normalizeHref(match[3]);
      const external = /^https?:\/\//i.test(href);
      output += `<a href="${escapeAttribute(href)}"${external ? " target=\"_blank\" rel=\"noopener noreferrer\"" : ""}>${escapeHtml(match[2])}</a>`;
    } else if (match[4] !== undefined) output += `<code>${escapeHtml(match[4])}</code>`;
    else if (match[5] !== undefined) output += `<strong>${escapeHtml(match[5])}</strong>`;
    else if (match[6] !== undefined) output += `<em>${escapeHtml(match[6])}</em>`;
    cursor = match.index + match[0].length;
  }
  output += escapeHtml(source.slice(cursor));
  return output;
}

function normalizeHref(href) {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|#)/i.test(trimmed)) return trimmed;
  if (/^(javascript:|data:|vbscript:)/i.test(trimmed)) return "#";
  if (/^README\.md$/i.test(trimmed)) return "REPOSITORIO.md";
  return trimmed.replace(/^\.\//, "");
}

function updateSearch() {
  const query = state.query.trim();
  state.searchResults = query.length >= 2
    ? rankSearchEntries(state.searchEntries, query, Number.MAX_SAFE_INTEGER)
    : [];
  renderSearchResults();
  applyFilters();
}

function renderSearchResults() {
  const query = state.query.trim();
  const searchIsActive = query.length >= 2;
  elements.searchSuggestions.hidden = Boolean(query);
  elements.searchResults.hidden = !searchIsActive;
  elements.searchResults.replaceChildren();
  if (!searchIsActive) return;

  const header = document.createElement("header");
  header.className = "search-results__heading";
  const heading = document.createElement("h3");
  heading.textContent = state.searchResults.length
    ? `${state.searchResults.length} ${state.searchResults.length === 1 ? "resultado" : "resultados"}`
    : "Sin resultados";
  const explanation = document.createElement("p");
  explanation.textContent = state.searchResults.length
    ? "Ordenados por relevancia. Mostramos los ocho primeros."
    : "Prueba un término más general, una unidad, una norma o el nombre del trámite.";
  header.append(heading, explanation);
  elements.searchResults.append(header);

  if (!state.searchResults.length) {
    const suggestions = document.createElement("p");
    suggestions.className = "search-results__empty";
    suggestions.textContent = "Ejemplos: «patentes», «POD», «permiso», «ERC», «compra» o «viaje».";
    elements.searchResults.append(suggestions);
    return;
  }

  const list = document.createElement("ol");
  list.className = "search-results__list";
  const terms = tokenizeSearchQuery(query);
  state.searchResults.slice(0, 8).forEach((entry) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "search-result";
    link.href = entry.href;
    link.dataset.searchResultId = entry.id;

    const meta = document.createElement("span");
    meta.className = "search-result__meta";
    const type = document.createElement("strong");
    type.textContent = entry.typeLabel;
    const category = document.createElement("span");
    category.textContent = entry.category;
    meta.append(type, category);

    const title = document.createElement("span");
    title.className = "search-result__title";
    appendHighlightedText(title, entry.title, terms);

    const snippet = document.createElement("span");
    snippet.className = "search-result__snippet";
    appendHighlightedText(snippet, createSearchSnippet(entry.content || entry.keywords || entry.category, query), terms);
    link.append(meta, title, snippet);
    item.append(link);
    list.append(item);
  });
  elements.searchResults.append(list);
}

function appendHighlightedText(container, value, terms) {
  const text = String(value ?? "");
  const normalized = normalizeText(text);
  const matches = terms
    .flatMap((term) => {
      const found = [];
      let cursor = 0;
      while (cursor < normalized.length) {
        const start = normalized.indexOf(term, cursor);
        if (start < 0) break;
        found.push({ start, end: start + term.length });
        cursor = start + term.length;
      }
      return found;
    })
    .sort((left, right) => left.start - right.start || right.end - left.end);
  let cursor = 0;
  matches.forEach((match) => {
    if (match.start < cursor) return;
    container.append(document.createTextNode(text.slice(cursor, match.start)));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(match.start, match.end);
    container.append(mark);
    cursor = match.end;
  });
  container.append(document.createTextNode(text.slice(cursor)));
}

function updateSearchStatus() {
  const query = state.query.trim();
  if (query.length === 1) {
    elements.searchStatus.textContent = "Escribe al menos dos caracteres.";
    return;
  }
  if (query.length >= 2) {
    const resultLabel = `${state.searchResults.length} ${state.searchResults.length === 1 ? "resultado" : "resultados"}`;
    const chapterLabel = `${state.visibleChapterCount} ${state.visibleChapterCount === 1 ? "capítulo visible" : "capítulos visibles"}`;
    elements.searchStatus.textContent = `${resultLabel}; ${chapterLabel}.`;
    return;
  }
  elements.searchStatus.textContent = `${state.sections.length} capítulos, trámites, herramientas, convocatorias y casos indexados.`;
}

function applyFilters() {
  const activeQuery = state.query.trim().length >= 2 ? state.query : "";
  const queryTerms = tokenizeSearchQuery(activeQuery);
  const allowed = FILTER_MAP[state.activeFilter];
  let visible = 0;
  document.querySelectorAll(".chapter").forEach((chapter) => {
    clearHighlights(chapter);
    const number = Number(chapter.dataset.section);
    const searchEntry = state.searchEntries.find((entry) => entry.type === "chapter" && entry.chapterNumber === number);
    const show = (!allowed || allowed.has(number)) && (!activeQuery || (searchEntry && matchesSearchQuery(searchEntry, activeQuery)));
    chapter.hidden = !show;
    if (show) { visible += 1; if (queryTerms.length) highlightTerms(chapter, queryTerms); }
  });
  document.querySelectorAll("[data-index-section]").forEach((link) => {
    const target = document.querySelector(`[data-section="${Number(link.dataset.indexSection)}"]`);
    link.closest("li").hidden = !target || target.hidden;
  });
  document.querySelectorAll(".index-group").forEach((group) => {
    group.hidden = [...group.querySelectorAll("li")].every((item) => item.hidden);
  });
  let empty = elements.manual.querySelector(".empty-results");
  if (visible === 0 && !empty) {
    empty = document.createElement("div");
    empty.className = "empty-results";
    empty.innerHTML = "<h2>No hay coincidencias</h2><p>Prueba otro término o selecciona «Todo».</p>";
    elements.manual.append(empty);
  } else if (visible > 0 && empty) empty.remove();
  state.visibleChapterCount = visible;
  updateSearchStatus();
  elements.clearSearch.disabled = !state.query;
  updateIndexToggleLabel();
  scheduleScrollSpyUpdate();
}

function setActiveFilter(filter, apply = true) {
  if (!(filter in FILTER_MAP)) return;
  state.activeFilter = filter;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const selectedGroup = elements.index.querySelector(`[data-index-category="${filter}"]`);
  if (selectedGroup) {
    state.indexExpandedAll = false;
    elements.index.querySelectorAll(".index-group").forEach((group) => { group.open = group === selectedGroup; });
    updateIndexToggleLabel();
  }
  if (apply) applyFilters();
}

function toggleCompleteIndex() {
  const groups = [...elements.index.querySelectorAll(".index-group:not([hidden])")];
  const expand = groups.some((group) => !group.open);
  state.indexExpandedAll = expand;
  state.indexFollowActive = expand;
  groups.forEach((group) => { group.open = expand; });
  window.requestAnimationFrame(() => {
    if (!expand) elements.index.scrollTo({ top: 0, behavior: "auto" });
    updateIndexToggleLabel();
  });
}

function updateIndexToggleLabel() {
  const button = elements.index.querySelector("#indexAllToggle");
  const groups = [...elements.index.querySelectorAll(".index-group:not([hidden])")];
  const allOpen = groups.length > 0 && groups.every((group) => group.open);
  state.indexExpandedAll = allOpen;
  if (button) button.textContent = allOpen ? "Contraer índice" : "Ver índice completo";
}

function highlightTerms(root, terms) {
  if (!terms.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim() || node.parentElement.closest("a, button, code, mark")) return NodeFilter.FILTER_REJECT;
      const normalized = normalizeText(node.nodeValue);
      return terms.some((term) => normalized.includes(term)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const matches = [];
  while (walker.nextNode()) matches.push(walker.currentNode);
  matches.forEach((node) => {
    const normalized = normalizeText(node.nodeValue);
    const positions = terms
      .map((term) => ({ start: normalized.indexOf(term), length: term.length }))
      .filter((match) => match.start >= 0)
      .sort((left, right) => left.start - right.start);
    if (!positions.length) return;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    positions.forEach((match) => {
      if (match.start < cursor) return;
      fragment.append(document.createTextNode(node.nodeValue.slice(cursor, match.start)));
      const mark = document.createElement("mark");
      mark.textContent = node.nodeValue.slice(match.start, match.start + match.length);
      fragment.append(mark);
      cursor = match.start + match.length;
    });
    fragment.append(document.createTextNode(node.nodeValue.slice(cursor)));
    node.replaceWith(fragment);
  });
}

function clearHighlights(root) {
  root.querySelectorAll("mark").forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent)));
  root.normalize();
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = elements.searchInput.value;
    if (state.query) setActiveFilter("all", false);
    updateSearch();
    elements.searchResults.querySelector("a")?.focus();
  });
  elements.searchInput.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.query = elements.searchInput.value;
    if (state.query && state.activeFilter !== "all") setActiveFilter("all", false);
    setSearchState("loading");
    state.searchTimer = window.setTimeout(() => { updateSearch(); setSearchState("success"); }, 150);
  });
  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    state.query = "";
    updateSearch();
    setSearchState("default");
    elements.searchInput.focus();
  });
  elements.searchSuggestions.addEventListener("click", (event) => {
    const suggestion = event.target.closest("[data-search-suggestion]");
    if (!suggestion) return;
    elements.searchInput.value = suggestion.dataset.searchSuggestion;
    state.query = elements.searchInput.value;
    setActiveFilter("all", false);
    updateSearch();
    setSearchState("success");
    elements.searchInput.focus();
  });
  elements.searchResults.addEventListener("click", (event) => {
    const link = event.target.closest("[data-search-result-id]");
    if (!link) return;
    const entry = state.searchResults.find((candidate) => candidate.id === link.dataset.searchResultId);
    if (!entry) return;
    if (entry.type === "funding") {
      const fundingInput = document.querySelector("#fundingQuery");
      if (fundingInput) {
        fundingInput.value = entry.queryValue;
        fundingInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    const target = entry.href.startsWith("#") ? document.querySelector(entry.href) : null;
    if (target?.hidden || target?.closest("[hidden]")) {
      target.hidden = false;
      target.closest("[hidden]")?.removeAttribute("hidden");
      window.setTimeout(() => {
        elements.searchInput.value = "";
        state.query = "";
        updateSearch();
        setSearchState("default");
      }, 0);
    }
  });
  elements.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    const firstResult = elements.searchResults.querySelector("a");
    if (!firstResult) return;
    event.preventDefault();
    firstResult.focus();
  });
  elements.searchResults.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = [...elements.searchResults.querySelectorAll("a")];
    const current = links.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    if (event.key === "Home") links[0]?.focus();
    else if (event.key === "End") links.at(-1)?.focus();
    else if (event.key === "ArrowDown") links[Math.min(current + 1, links.length - 1)]?.focus();
    else if (current === 0) elements.searchInput.focus();
    else links[current - 1]?.focus();
  });
  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    setActiveFilter(button.dataset.filter);
  });
  elements.domainDirectory.addEventListener("click", (event) => {
    const link = event.target.closest("[data-domain-target]");
    if (link) setActiveFilter(link.dataset.domainTarget);
  });
  elements.manual.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-target]");
    if (!button) return;
    const url = new URL(window.location.href);
    url.hash = button.dataset.copyTarget;
    try { await copyText(url.toString()); setTemporaryButtonState(button, "success", "Copiado"); }
    catch { setTemporaryButtonState(button, "error", "No copiado"); }
  });
  elements.menuButton.addEventListener("click", openMenu);
  elements.closeMenuButton.addEventListener("click", closeMenu);
  elements.menuScrim.addEventListener("click", closeMenu);
  elements.index.addEventListener("click", (event) => {
    if (event.target.closest("#indexAllToggle")) { toggleCompleteIndex(); return; }
    const chapterLink = event.target.closest("[data-index-section]");
    if (chapterLink) {
      const chapter = state.sections.find((section) => section.number === Number(chapterLink.dataset.indexSection));
      if (chapter) setActiveFilter(chapter.categoryId);
    }
    if (event.target.closest("a")) closeMenu();
  });
  desktopMenuMedia.addEventListener("change", syncMenuMode);
  window.addEventListener("hashchange", applyHashFocus);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !isTypingTarget(event.target)) { event.preventDefault(); elements.searchInput.focus(); }
    if (event.key === "Escape") {
      if (elements.indexPanel.classList.contains("is-open")) closeMenu();
      else if (document.activeElement === elements.searchInput && elements.searchInput.value) elements.clearSearch.click();
    }
  });
  elements.backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }));
  window.addEventListener("scroll", () => elements.backToTop.classList.toggle("is-visible", window.scrollY > 700), { passive: true });
}

function setupScrollSpy() {
  if (!state.scrollSpyBound) {
    window.addEventListener("scroll", scheduleScrollSpyUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollSpyUpdate);
    state.scrollSpyBound = true;
  }
  scheduleScrollSpyUpdate();
}

function scheduleScrollSpyUpdate() {
  if (state.scrollSpyFrame !== null) return;
  state.scrollSpyFrame = window.requestAnimationFrame(() => {
    state.scrollSpyFrame = null;
    updateScrollLocation();
  });
}

function updateScrollLocation() {
  const mastheadHeight = document.querySelector(".masthead")?.getBoundingClientRect().height || 0;
  const probeLine = mastheadHeight + 24;
  const landmarkItems = NAV_LANDMARKS.map((item, order) => navigationItem(item, order, "section"));
  const chapterItems = state.sections.map((section, index) => navigationItem({
    id: section.slug,
    label: `Capítulo ${String(section.number).padStart(2, "0")} · ${section.title}`,
    parentId: "indice-capitulos",
    categoryId: section.categoryId,
    typeLabel: "Capítulo",
    sectionNumber: section.number
  }, NAV_LANDMARKS.length + index, "chapter"));
  const active = pickCurrentNavigationItem([...landmarkItems, ...chapterItems], probeLine);
  if (active) setCurrentNavigation(active);
}

function navigationItem(definition, order, kind) {
  const element = document.getElementById(definition.id);
  const hidden = !element || element.hidden || Boolean(element?.closest("[hidden]"));
  return {
    ...definition,
    kind,
    order,
    element,
    hidden,
    top: hidden ? Number.POSITIVE_INFINITY : element.getBoundingClientRect().top
  };
}

function setCurrentNavigation(active) {
  const changed = state.activeNavigationId !== active.id;
  state.activeNavigationId = active.id;

  const currentLink = elements.index.querySelector("#indexCurrentLink");
  const currentContext = elements.index.querySelector("#indexCurrentContext");
  if (currentLink) {
    currentLink.href = `#${active.id}`;
    currentLink.textContent = active.label;
  }
  if (currentContext) {
    const category = CATEGORIES.find((item) => item.id === active.categoryId);
    currentContext.textContent = category ? `${active.typeLabel} · ${category.shortLabel}` : active.typeLabel;
  }

  document.querySelectorAll("[data-index-anchor]").forEach((link) => {
    const current = link.dataset.indexAnchor === (active.parentId || active.id);
    link.toggleAttribute("aria-current", current);
    if (current) link.setAttribute("aria-current", "location");
  });
  document.querySelectorAll("[data-index-section]").forEach((link) => {
    const current = active.kind === "chapter" && Number(link.dataset.indexSection) === active.sectionNumber;
    link.toggleAttribute("aria-current", current);
    if (current) link.setAttribute("aria-current", "location");
  });
  document.querySelectorAll(".index-group").forEach((group) => {
    group.dataset.current = String(Boolean(active.categoryId && group.dataset.indexCategory === active.categoryId));
  });

  if (!changed || active.kind !== "chapter" || !state.indexFollowActive) return;
  const group = elements.index.querySelector(`[data-index-category="${active.categoryId}"]`);
  const chapterLink = elements.index.querySelector(`[data-index-section="${active.sectionNumber}"]`);
  if (group && !group.open) group.open = true;
  window.requestAnimationFrame(() => revealIndexItem(chapterLink));
}

function revealIndexItem(item) {
  if (!item) return;
  const indexRect = elements.index.getBoundingClientRect();
  const stickyBottom = elements.index.querySelector(".index-location")?.getBoundingClientRect().bottom || indexRect.top;
  const itemRect = item.getBoundingClientRect();
  if (itemRect.top < stickyBottom + 8) elements.index.scrollTop -= stickyBottom + 8 - itemRect.top;
  else if (itemRect.bottom > indexRect.bottom - 8) elements.index.scrollTop += itemRect.bottom - indexRect.bottom + 8;
}

function openMenu() {
  if (desktopMenuMedia.matches) return;
  elements.indexPanel.removeAttribute("inert");
  elements.indexPanel.setAttribute("aria-hidden", "false");
  elements.indexPanel.classList.add("is-open");
  elements.menuButton.setAttribute("aria-expanded", "true");
  elements.menuScrim.hidden = false;
  elements.pageShell.inert = true;
  elements.closeMenuButton.focus();
}
function closeMenu() {
  if (!elements.indexPanel.classList.contains("is-open")) return;
  elements.indexPanel.classList.remove("is-open");
  elements.menuButton.setAttribute("aria-expanded", "false");
  elements.menuScrim.hidden = true;
  elements.pageShell.inert = false;
  elements.menuButton.focus({ preventScroll: true });
  elements.indexPanel.setAttribute("aria-hidden", "true");
  elements.indexPanel.setAttribute("inert", "");
}
function syncMenuMode() {
  const desktop = desktopMenuMedia.matches;
  const open = !desktop && elements.indexPanel.classList.contains("is-open");
  if (desktop) elements.indexPanel.classList.remove("is-open");
  if (!desktop && !open && elements.indexPanel.contains(document.activeElement)) {
    elements.menuButton.focus({ preventScroll: true });
  }
  elements.menuButton.setAttribute("aria-expanded", String(open));
  elements.menuScrim.hidden = !open;
  elements.pageShell.inert = open;
  elements.indexPanel.toggleAttribute("inert", !desktop && !open);
  if (desktop) elements.indexPanel.removeAttribute("aria-hidden");
  else elements.indexPanel.setAttribute("aria-hidden", String(!open));
}
function setSearchState(nextState) {
  elements.searchControl.dataset.state = nextState;
  elements.searchInput.setAttribute("aria-invalid", String(nextState === "error"));
}
function setTemporaryButtonState(button, nextState, label) {
  button.dataset.state = nextState;
  button.textContent = label;
  window.setTimeout(() => { button.dataset.state = "default"; button.textContent = "Copiar enlace"; }, 2500);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const temporary = document.createElement("textarea");
  temporary.value = value;
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.append(temporary);
  temporary.select();
  const copied = document.execCommand("copy");
  temporary.remove();
  if (!copied) throw new Error("El navegador no permitió copiar el enlace.");
}

function renderLoadError(error) {
  const panel = document.createElement("div");
  panel.className = "manual-error";
  const title = document.createElement("h2");
  title.textContent = "No se pudo cargar la guía";
  const message = document.createElement("p");
  message.textContent = `${error.message} Abre la web mediante un servidor local o consulta el archivo Markdown.`;
  const link = document.createElement("a");
  link.href = "MANUAL_PROCEDIMIENTOS.md";
  link.textContent = "Abrir el manual en Markdown";
  panel.append(title, message, link);
  elements.manual.replaceChildren(panel);
  elements.index.innerHTML = '<p class="loading-copy">El índice no está disponible.</p>';
  elements.searchStatus.textContent = "No se pudo cargar el contenido.";
}

function countLinks(markdown) { return (markdown.match(/\[[^\]]+\]\([^)]+\)/g) || []).length; }
function countExamples(markdown) { return (markdown.match(/^> \*\*Ejemplo realista\b/gm) || []).length; }
function getCategory(sectionNumber) {
  const category = CATEGORIES.find((candidate) => candidate.sections.includes(sectionNumber));
  if (!category) throw new Error(`El capítulo ${sectionNumber} no tiene un ámbito asignado.`);
  return category;
}
function stripMarkdown(value) { return value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_>#|:-]/g, " ").replace(/\s+/g, " "); }
function slugify(value) { return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function normalizeText(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es"); }
function formatDate(value) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
  return parsed && !Number.isNaN(parsed.valueOf())
    ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
    : "Sin fecha";
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#96;"); }
function isTypingTarget(target) { return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable; }
function prefersReducedMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
function applyHashFocus() {
  if (!window.location.hash) return;
  try {
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target?.matches("details")) target.open = true;
    const containingDetails = target?.closest("details");
    if (containingDetails) containingDetails.open = true;
    if (target?.matches(".chapter")) setActiveFilter(target.dataset.category);
    window.requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
  } catch { /* La URL puede contener un hash externo no seleccionable. */ }
}
