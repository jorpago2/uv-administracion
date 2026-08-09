import "./site-shell.js";
import manualData from "./data/manual.json";
import { CATEGORIES } from "./chapter-categories.js";
import { situationGuides } from "./situations.js";

const areaId = document.body.dataset.area;
const category = CATEGORIES.find((candidate) => candidate.id === areaId);
if (!category) throw new Error(`Ámbito desconocido: ${areaId}.`);

const chapters = parseChapters(manualData.markdown).filter((chapter) => category.sections.includes(chapter.number));
const cases = situationGuides.filter((guide) => category.sections.includes(Number(guide.chapterNumber)));

document.title = `${category.shortLabel} · Guía operativa UV`;
document.querySelector("#areaKicker").textContent = `${chapters.length} capítulos · ${cases.length} situaciones`;
document.querySelector("#areaTitle").textContent = category.label;
document.querySelector("#areaSummary").textContent = category.summary;
renderTools();
renderChapters();
renderCases(cases);
bindCaseSearch();

function renderTools() {
  const container = document.querySelector("#areaTools");
  container.replaceChildren(...category.tools.map((tool) => {
    const link = document.createElement("a");
    link.href = routeTool(tool.href);
    link.innerHTML = `<strong>${escapeHtml(tool.label)}</strong><span>Abrir recurso</span>`;
    return link;
  }));
}

function renderChapters() {
  const list = document.querySelector("#areaChapters");
  list.replaceChildren(...chapters.map((chapter) => {
    const item = document.createElement("li");
    item.id = `capitulo-${chapter.number}`;
    item.innerHTML = `<a href="../manual/#${chapter.slug}"><span>${String(chapter.number).padStart(2, "0")}</span><strong>${escapeHtml(chapter.title)}</strong><small>Leer capítulo</small></a>`;
    return item;
  }));
}

function renderCases(items) {
  const list = document.querySelector("#areaCases");
  list.replaceChildren(...items.map((guide) => {
    const article = document.createElement("article");
    article.className = "area-case";
    article.innerHTML = `
      <span>${String(guide.situationNumber).padStart(2, "0")}</span>
      <div><h3>${escapeHtml(guide.title)}</h3><p>${escapeHtml(guide.scenario)}</p><p><strong>Resultado:</strong> ${escapeHtml(guide.outcome)}</p></div>
      <a href="../example.html?caso=${encodeURIComponent(guide.id)}">Resolver caso</a>`;
    return article;
  }));
  document.querySelector("#areaCaseStatus").textContent = `${items.length} ${items.length === 1 ? "situación visible" : "situaciones visibles"}.`;
}

function bindCaseSearch() {
  const input = document.querySelector("#areaCaseQuery");
  input.addEventListener("input", () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    const filtered = cases.filter((guide) => terms.every((term) => normalize(`${guide.title} ${guide.scenario} ${guide.outcome}`).includes(term)));
    renderCases(filtered);
  });
}

function parseChapters(markdown) {
  return [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((match) => ({ number: Number(match[1]), title: match[2].trim(), slug: slugify(match[2]) }));
}

function routeTool(href) {
  if (href.startsWith("#explorador") || href.startsWith("#preparador")) return `../financiacion/${href}`;
  if (href.startsWith("#")) return `../herramientas/${href}`;
  if (href === "ALERTAS.md") return "../ALERTAS.md";
  return href;
}

function slugify(value) { return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function normalize(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }

