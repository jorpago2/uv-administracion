import "./site-shell.js";
import catalogueJson from "./data/academic-programmes.json";
import { DOCUMENT_TYPES, filterAcademicProgrammes, validateAcademicProgrammes } from "./academic-programmes-model.js";

const catalogue = validateAcademicProgrammes(catalogueJson);
const form = document.querySelector("#programmeFilters");
const query = document.querySelector("#programmeQuery");
const scope = document.querySelector("#programmeScope");
const level = document.querySelector("#programmeLevel");
const documentType = document.querySelector("#programmeDocumentType");
const status = document.querySelector("#programmeStatus");
const list = document.querySelector("#programmeList");

document.querySelector("#catalogueReviewedAt").textContent = formatDate(catalogue.reviewedAt);
document.querySelector("#catalogueScopeNote").textContent = catalogue.scopeNote;
renderStructures();
populateDocumentTypes();
applyUrlFilters();
render();
scrollToRequestedProgramme();

form.addEventListener("input", render);
form.addEventListener("change", render);
form.addEventListener("reset", () => window.setTimeout(() => {
  history.replaceState(null, "", window.location.pathname);
  render();
}, 0));

function render() {
  const filters = { query: query.value, scope: scope.value, level: level.value, documentType: documentType.value };
  const programmes = filterAcademicProgrammes(catalogue.programmes, filters);
  list.replaceChildren(...programmes.map(renderProgramme));
  const documentCount = programmes.reduce((total, programme) => total + programme.documents.length, 0);
  status.textContent = programmes.length
    ? `${programmes.length} ${programmes.length === 1 ? "programa" : "programas"} · ${documentCount} ${documentCount === 1 ? "enlace documental" : "enlaces documentales"}.`
    : "No hay documentos que coincidan con esos filtros.";
}

function renderProgramme(programme) {
  const article = document.createElement("article");
  article.className = "programme-card";
  article.id = programme.id;
  article.innerHTML = `
    <header class="programme-card__head">
      <div><p class="programme-card__eyebrow">${escapeHtml(programme.scopeLabel)} · ${escapeHtml(programme.levelLabel)}</p><h2>${escapeHtml(programme.acronym)} <span>${escapeHtml(programme.name)}</span></h2></div>
      <dl><div><dt>Código UV</dt><dd>${escapeHtml(programme.uvCode)}</dd></div><div><dt>RUCT</dt><dd>${escapeHtml(programme.ructId)}</dd></div></dl>
    </header>
    <div class="programme-card__context">
      <p><strong>Centro:</strong> ${escapeHtml(programme.centre)}</p>
      <p><strong>Participación docente/organización:</strong> ${escapeHtml(programme.department)}</p>
      <p><strong>Gobernanza académica:</strong> ${escapeHtml(programme.governance)}</p>
    </div>
    <aside class="programme-card__first"><strong>Qué mirar primero</strong><p>${escapeHtml(programme.firstCheck)}</p></aside>
    <div class="programme-documents">${programme.documents.map(renderDocument).join("")}</div>`;
  return article;
}

function renderDocument(document) {
  return `<a class="programme-document" href="${escapeHtml(document.url)}" target="_blank" rel="noreferrer">
    <span>${escapeHtml(document.typeLabel)}</span>
    <strong>${escapeHtml(document.title)}</strong>
    <p>${escapeHtml(document.purpose)}</p>
    <small>${escapeHtml(document.status)} · Fuente oficial ↗</small>
  </a>`;
}

function renderStructures() {
  const container = document.querySelector("#academicStructures");
  container.replaceChildren(...catalogue.structures.map((structure) => {
    const link = document.createElement("a");
    link.href = structure.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.innerHTML = `<strong>${escapeHtml(structure.name)}</strong><span>${escapeHtml(structure.role)}</span><small>Fuente oficial ↗</small>`;
    return link;
  }));
}

function populateDocumentTypes() {
  documentType.replaceChildren(...DOCUMENT_TYPES.map((type) => {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.label;
    return option;
  }));
}

function applyUrlFilters() {
  const parameters = new URLSearchParams(window.location.search);
  const requestedScope = parameters.get("ambito");
  const requestedProgramme = parameters.get("programa");
  if ([...scope.options].some((option) => option.value === requestedScope)) scope.value = requestedScope;
  if (requestedProgramme) query.value = requestedProgramme;
}

function scrollToRequestedProgramme() {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
