import glossaryData from "./data/glossary.json";
import { chapterHref } from "./chapter-links.js";

export function glossarySearchItems() {
  validateGlossaryData(glossaryData);
  return glossaryData.terms.map((item) => ({
    id: item.id,
    term: item.term,
    category: categoryLabel(item.category),
    content: [item.expanded, item.definition, item.practical, item.caution, ...(item.aliases ?? [])].filter(Boolean).join(" ")
  }));
}

export function initGlossary(root) {
  if (!(root instanceof HTMLElement)) throw new TypeError("Falta la sección del glosario.");
  validateGlossaryData(glossaryData);
  const elements = {
    query: root.querySelector("#glossaryQuery"),
    category: root.querySelector("#glossaryCategory"),
    clear: root.querySelector("#glossaryClear"),
    status: root.querySelector("#glossaryStatus"),
    list: root.querySelector("#glossaryList"),
    count: root.querySelector("#glossaryCount"),
    reviewed: root.querySelector("#glossaryReviewed")
  };
  const missing = Object.entries(elements).filter(([, node]) => !node).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan controles del glosario: ${missing.join(", ")}`);

  const state = { query: "", category: "all", exactId: null };
  populateCategories(elements.category);
  elements.count.textContent = String(glossaryData.terms.length);
  elements.reviewed.textContent = formatDate(glossaryData.meta.reviewed);
  bindEvents();
  render();
  const initialTermId = termIdFromHash(window.location.hash);
  if (initialTermId) queueMicrotask(() => focusTerm(initialTermId));

  return Object.freeze({ focusTerm, count: glossaryData.terms.length });

  function bindEvents() {
    elements.query.addEventListener("input", () => {
      state.query = elements.query.value;
      state.exactId = null;
      clearTermHash();
      render();
    });
    elements.category.addEventListener("change", () => {
      state.category = elements.category.value;
      state.exactId = null;
      clearTermHash();
      render();
    });
    elements.clear.addEventListener("click", () => {
      state.query = "";
      state.category = "all";
      state.exactId = null;
      elements.query.value = "";
      elements.category.value = "all";
      clearTermHash();
      render();
      elements.query.focus();
    });
    window.addEventListener("hashchange", () => {
      const termId = termIdFromHash(window.location.hash);
      if (termId) focusTerm(termId);
    });
  }

  function render() {
    const query = normalize(state.query);
    const terms = glossaryData.terms
      .filter((item) => !state.exactId || item.id === state.exactId)
      .filter((item) => state.category === "all" || item.category === state.category)
      .filter((item) => !query || normalize(searchableText(item)).includes(query))
      .sort((left, right) => left.term.localeCompare(right.term, "es"));
    const fragment = document.createDocumentFragment();
    terms.forEach((item) => fragment.append(renderTerm(item)));
    if (!terms.length) fragment.append(renderEmpty());
    elements.list.replaceChildren(fragment);
    elements.status.textContent = terms.length === 1
      ? `1 término visible de ${glossaryData.terms.length}.`
      : `${terms.length} términos visibles de ${glossaryData.terms.length}.`;
    elements.clear.disabled = !state.query && state.category === "all";
  }

  function focusTerm(id) {
    const item = glossaryData.terms.find((candidate) => candidate.id === id);
    if (!item) return false;
    state.query = item.term;
    state.category = "all";
    state.exactId = item.id;
    elements.query.value = item.term;
    elements.category.value = "all";
    render();
    const card = root.querySelector(`#termino-${CSS.escape(item.id)}`);
    if (!card) return false;
    card.open = true;
    card.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    window.setTimeout(() => card.querySelector("summary")?.focus(), prefersReducedMotion() ? 0 : 350);
    return true;
  }
}

function renderTerm(item) {
  const details = document.createElement("details");
  details.className = "glossary-card";
  details.id = `termino-${item.id}`;

  const summary = document.createElement("summary");
  const heading = document.createElement("span");
  heading.className = "glossary-card__heading";
  const category = document.createElement("span");
  category.className = "glossary-card__category";
  category.textContent = categoryLabel(item.category);
  const term = document.createElement("strong");
  term.textContent = item.term;
  heading.append(category, term);
  if (item.expanded) {
    const expanded = document.createElement("span");
    expanded.className = "glossary-card__expanded";
    expanded.textContent = item.expanded;
    heading.append(expanded);
  }
  const definition = document.createElement("span");
  definition.className = "glossary-card__definition";
  definition.textContent = item.definition;
  const marker = document.createElement("span");
  marker.className = "glossary-card__marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "+";
  summary.append(heading, definition, marker);

  const body = document.createElement("div");
  body.className = "glossary-card__body";
  body.append(labeledText("En la práctica", item.practical, "practice"), labeledText("No lo confundas", item.caution, "caution"));

  const footer = document.createElement("footer");
  footer.className = "glossary-card__footer";
  const sources = document.createElement("div");
  sources.className = "glossary-card__sources";
  const sourceLabel = document.createElement("strong");
  sourceLabel.textContent = "Fuentes";
  sources.append(sourceLabel);
  item.sourceIds.forEach((sourceId) => {
    const source = glossaryData.sources[sourceId];
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = source.label;
    sources.append(link);
  });
  footer.append(sources);
  if (item.chapters?.length) {
    const chapters = document.createElement("div");
    chapters.className = "glossary-card__chapters";
    const chapterLabel = document.createElement("strong");
    chapterLabel.textContent = "En esta guía";
    chapters.append(chapterLabel);
    item.chapters.forEach((number) => {
      const link = document.createElement("a");
      link.href = chapterHref(number);
      link.textContent = `Cap. ${number}`;
      chapters.append(link);
    });
    footer.append(chapters);
  }
  body.append(footer);
  details.append(summary, body);
  return details;
}

function labeledText(label, value, modifier) {
  const wrapper = document.createElement("div");
  wrapper.className = `glossary-card__note glossary-card__note--${modifier}`;
  const title = document.createElement("strong");
  title.textContent = label;
  const text = document.createElement("p");
  text.textContent = value;
  wrapper.append(title, text);
  return wrapper;
}

function renderEmpty() {
  const empty = document.createElement("div");
  empty.className = "glossary-empty";
  const title = document.createElement("h3");
  title.textContent = "No aparece ese término";
  const text = document.createElement("p");
  text.textContent = "Prueba una sigla, una palabra más general o selecciona todos los ámbitos. Si sigue sin aparecer, conviene incorporarlo al glosario.";
  empty.append(title, text);
  return empty;
}

function populateCategories(select) {
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Todos los ámbitos";
  select.append(all);
  glossaryData.categories.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    select.append(option);
  });
}

function validateGlossaryData(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.categories) || !Array.isArray(data.terms)) throw new TypeError("El glosario no tiene el formato esperado.");
  const categories = new Set(data.categories.map((item) => item.id));
  const ids = new Set();
  data.terms.forEach((item) => {
    if (!item.id || ids.has(item.id)) throw new Error(`Identificador de glosario inválido o duplicado: ${item.id ?? "vacío"}.`);
    ids.add(item.id);
    if (!categories.has(item.category) || !item.term || !item.definition || !item.practical || !item.caution) throw new Error(`Término de glosario incompleto: ${item.id}.`);
    if (!Array.isArray(item.sourceIds) || !item.sourceIds.length || item.sourceIds.some((id) => !data.sources[id])) throw new Error(`Fuentes de glosario inválidas: ${item.id}.`);
  });
}

function categoryLabel(id) {
  return glossaryData.categories.find((item) => item.id === id)?.label ?? "Glosario";
}

function searchableText(item) {
  return [item.term, item.expanded, item.definition, item.practical, item.caution, ...(item.aliases ?? [])].filter(Boolean).join(" ");
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? new Date(`${value}T12:00:00`) : null;
  return date ? new Intl.DateTimeFormat("es-ES").format(date) : "sin fecha";
}

function termIdFromHash(hash) {
  return hash.startsWith("#termino-") ? hash.slice("#termino-".length) : null;
}

function clearTermHash() {
  if (termIdFromHash(window.location.hash)) history.replaceState(null, "", "#glosario");
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
