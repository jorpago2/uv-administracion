import "./site-shell.js";
import manualData from "./data/manual.json";
import academicProgrammesData from "./data/academic-programmes.json";
import personalResearchData from "./data/personal-research-context.json";
import { CATEGORIES } from "./chapter-categories.js";
import { situationGuides } from "./situations.js";
import { guideBelongsToArea } from "./area-model.js";

const areaId = document.body.dataset.area;
const category = CATEGORIES.find((candidate) => candidate.id === areaId);
if (!category) throw new Error(`Ámbito desconocido: ${areaId}.`);
const academicProgrammeById = new Map(academicProgrammesData.programmes.map((programme) => [programme.id, programme]));
const researchStageById = new Map(personalResearchData.stages.map((stage) => [stage.id, stage]));

const chapters = parseChapters(manualData.markdown).filter((chapter) => category.sections.includes(chapter.number));
const cases = situationGuides.filter((guide) => guideBelongsToArea(guide, areaId));

document.title = `${category.shortLabel} · Guía operativa UV`;
document.querySelector("#areaKicker").textContent = `${chapters.length} capítulos · ${cases.length} situaciones`;
document.querySelector("#areaTitle").textContent = category.label;
document.querySelector("#areaSummary").textContent = category.summary;
renderTools();
renderResearchProfile();
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

function renderResearchProfile() {
  const container = document.querySelector("#researchProfile");
  if (!container) return;
  const themes = personalResearchData.themes.map((theme) => `<span class="research-tag" title="${escapeHtml(theme.description)}">${escapeHtml(theme.label)}</span>`).join("");
  const stages = personalResearchData.stages
    .filter((stage) => !["management", "transfer", "protection"].includes(stage.id))
    .map((stage) => `<li><strong>${escapeHtml(stage.label)}</strong><span>${escapeHtml(stage.description)}</span></li>`)
    .join("");
  const resources = personalResearchData.resources
    .filter((resource) => ["jorge-uv", "umdo", "lfnn", "scsie"].includes(resource.id))
    .map((resource) => `<a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.label)}</a>`)
    .join("");
  container.innerHTML = `
    <p class="hub-kicker">Perfil personal de Jorge Parra</p>
    <h2>${escapeHtml(personalResearchData.title)}</h2>
    <p>${escapeHtml(personalResearchData.summary)}</p>
    <div class="research-tags" aria-label="Temáticas de investigación">${themes}</div>
    <details class="research-cycle-details"><summary>Ver el ciclo técnico · 6 fases</summary><ol class="research-cycle">${stages}</ol></details>
    <nav class="research-profile-links" aria-label="Fuentes oficiales del perfil">${resources}</nav>
    <p class="area-context-note">${escapeHtml(personalResearchData.scopeNote)}</p>`;
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
    const programmeTags = (guide.academicContext?.programmeIds ?? [])
      .map((id) => academicProgrammeById.get(id))
      .filter(Boolean)
      .map((programme) => `<span class="academic-tag" title="${escapeHtml(programme.name)}">${escapeHtml(programme.acronym)}</span>`)
      .join("");
    const researchTags = guide.personalResearchContext ? [
      `<span class="research-tag research-tag--${guide.personalResearchContext.fit}">${guide.personalResearchContext.fit === "conditional" ? "ICMUV · condicional" : "ICMUV"}</span>`,
      ...guide.personalResearchContext.stages.slice(0, 3).map((id) => researchStageById.get(id)).filter(Boolean).map((stage) => `<span class="research-tag">${escapeHtml(stage.label)}</span>`)
    ].join("") : "";
    article.innerHTML = `
      <span>${String(guide.situationNumber).padStart(2, "0")}</span>
      <div><h3>${escapeHtml(guide.title)}</h3><p>${escapeHtml(guide.scenario)}</p><p><strong>Resultado:</strong> ${escapeHtml(guide.outcome)}</p>${programmeTags ? `<div class="academic-tags" aria-label="Titulaciones contextualizadas">${programmeTags}</div>` : ""}${researchTags ? `<div class="research-tags" aria-label="Aplicación al ciclo ICMUV">${researchTags}</div>` : ""}</div>
      <a href="../example.html?caso=${encodeURIComponent(guide.id)}">Resolver caso</a>`;
    return article;
  }));
  document.querySelector("#areaCaseStatus").textContent = `${items.length} ${items.length === 1 ? "situación visible" : "situaciones visibles"}.`;
}

function bindCaseSearch() {
  const input = document.querySelector("#areaCaseQuery");
  input.addEventListener("input", () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    const filtered = cases.filter((guide) => terms.every((term) => normalize([
      guide.title, guide.scenario, guide.outcome, guide.academicContext?.authority,
      ...(guide.academicContext?.programmeIds ?? []), ...(guide.academicContext?.differences ?? []),
      guide.personalResearchContext?.application, guide.personalResearchContext?.example,
      ...(guide.personalResearchContext?.stages ?? [])
    ].join(" ")).includes(term)));
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
