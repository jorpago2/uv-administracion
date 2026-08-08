import manualData from "./data/manual.json";

const CATEGORIES = Object.freeze([
  { id: "planificacion", label: "Orientación y planificación", sections: Object.freeze([1, 2, 18, 19, 20]) },
  { id: "docencia", label: "Docencia", sections: Object.freeze([3, 4, 5, 6]) },
  { id: "pdi", label: "Carrera y condiciones PDI", sections: Object.freeze([7, 8]) },
  { id: "investigacion", label: "Investigación y transferencia", sections: Object.freeze([9, 10, 11]) },
  { id: "gestion", label: "Gestión administrativa y económica", sections: Object.freeze([12, 13]) },
  { id: "cumplimiento", label: "Cumplimiento, seguridad y derechos", sections: Object.freeze([14, 15, 16, 17]) }
]);

const FILTER_MAP = Object.freeze({
  all: null,
  ...Object.fromEntries(CATEGORIES.map((category) => [category.id, new Set(category.sections)]))
});

const state = { sections: [], activeFilter: "all", query: "", searchTimer: null, observer: null };
const elements = {
  manual: document.querySelector("#manual"),
  index: document.querySelector("#chapterIndex"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  searchControl: document.querySelector("#searchControl"),
  clearSearch: document.querySelector("#clearSearch"),
  searchStatus: document.querySelector("#searchStatus"),
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
  backToTop: document.querySelector("#backToTop")
};

assertRequiredElements(elements);
bindEvents();
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
    renderMetadata(data.meta, parsed.sections.length, countLinks(data.markdown), countExamples(data.markdown));
    renderIntroduction(parsed.introduction);
    renderSections(parsed.sections);
    renderIndex(parsed.sections);
    setSearchState("success");
    elements.manual.dataset.state = "success";
    elements.manual.setAttribute("aria-busy", "false");
    setupSectionObserver();
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
    body.innerHTML = renderMarkdown(section.body);
    titleBlock.append(category, title);
    header.append(titleBlock, copyButton);
    article.append(header, body);
    fragment.append(article);
  });
  elements.manual.append(fragment);
}

function renderIndex(sections) {
  const fragment = document.createDocumentFragment();
  CATEGORIES.forEach((category) => {
    const categorySections = sections.filter((section) => section.categoryId === category.id);
    if (!categorySections.length) return;
    const group = document.createElement("section");
    group.className = "index-group";
    const heading = document.createElement("h2");
    heading.className = "index-group__title";
    heading.textContent = category.label;
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
    fragment.append(group);
  });
  elements.index.replaceChildren(fragment);
}

function renderMarkdown(markdown) {
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
      const className = /^\*\*Ejemplo realista\b/.test(quoteText) ? " class=\"case-example\"" : "";
      html.push(`<blockquote${className}>${renderInline(quoteText)}</blockquote>`);
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
  const tokenPattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*|\*([^*]+)\*)/g;
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

function applyFilters() {
  const normalizedQuery = normalizeText(state.query);
  const allowed = FILTER_MAP[state.activeFilter];
  let visible = 0;
  document.querySelectorAll(".chapter").forEach((chapter) => {
    clearHighlights(chapter);
    const number = Number(chapter.dataset.section);
    const show = (!allowed || allowed.has(number)) && (!normalizedQuery || chapter.dataset.searchText.includes(normalizedQuery));
    chapter.hidden = !show;
    if (show) { visible += 1; if (normalizedQuery) highlightText(chapter, state.query.trim()); }
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
  elements.searchStatus.textContent = `${visible} ${visible === 1 ? "capítulo visible" : "capítulos visibles"}.`;
  elements.clearSearch.disabled = !state.query;
}

function highlightText(root, query) {
  if (!query) return;
  const needle = normalizeText(query);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim() || node.parentElement.closest("a, button, code, mark")) return NodeFilter.FILTER_REJECT;
      return normalizeText(node.nodeValue).includes(needle) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const matches = [];
  while (walker.nextNode()) matches.push(walker.currentNode);
  matches.forEach((node) => {
    const start = normalizeText(node.nodeValue).indexOf(needle);
    if (start < 0) return;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, Math.min(start + query.length, node.nodeValue.length));
    const mark = document.createElement("mark");
    range.surroundContents(mark);
  });
}

function clearHighlights(root) {
  root.querySelectorAll("mark").forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent)));
  root.normalize();
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", (event) => event.preventDefault());
  elements.searchInput.addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.query = elements.searchInput.value;
    setSearchState("loading");
    state.searchTimer = window.setTimeout(() => { applyFilters(); setSearchState("success"); }, 250);
  });
  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    state.query = "";
    applyFilters();
    setSearchState("default");
    elements.searchInput.focus();
  });
  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.activeFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
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
  elements.index.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
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

function setupSectionObserver() {
  if (!("IntersectionObserver" in window)) return;
  state.observer?.disconnect();
  state.observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    document.querySelectorAll("[data-index-section]").forEach((link) => {
      if (link.getAttribute("href") === `#${visible.target.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-20% 0px -68% 0px", threshold: [0, 0.1, 0.5] });
  document.querySelectorAll(".chapter").forEach((chapter) => state.observer.observe(chapter));
}

function openMenu() {
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
  try { document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" }); } catch { /* La URL puede contener un hash externo no seleccionable. */ }
}
