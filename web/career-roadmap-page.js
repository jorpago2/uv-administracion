import "./site-shell.js";
import careerData from "./data/career-roadmap.json";
import { PROFILE_DEFAULTS, buildCareerAssessment, evaluateOpportunity, exportCareerRoadmapMarkdown } from "./career-roadmap-model.js";

const STORAGE_KEY = "uv-career-roadmap-profile-v3";
const PREVIOUS_STORAGE_KEYS = ["uv-career-roadmap-profile-v2", "uv-career-roadmap-profile-v1"];
const form = document.querySelector("#careerProfileForm");
let assessment;

loadProfile();
renderStaticContent();
updateAssessment();
updateOpportunity();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateAssessment();
  document.querySelector("#careerResult").focus({ preventScroll: true });
});
form.addEventListener("input", updateAssessment);
document.querySelector("#careerReset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  for (const key of PREVIOUS_STORAGE_KEYS) localStorage.removeItem(key);
  writeForm(PROFILE_DEFAULTS);
  updateAssessment();
});
document.querySelector("#careerExport").addEventListener("click", exportPlan);
document.querySelector("#opportunityForm").addEventListener("input", updateOpportunity);

function updateAssessment() {
  const profile = readForm();
  assessment = buildCareerAssessment(profile, careerData, new Date());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assessment.profile));
  renderDiagnosis();
  renderPriorities();
  renderRoadmap();
}

function renderDiagnosis() {
  const statusLabels = { ready: "Resuelto", evidence: "Falta evidencia", gap: "Brecha", waiting: "En curso", future: "Vigilar" };
  const result = document.querySelector("#careerResult");
  result.tabIndex = -1;
  result.innerHTML = `
    <div class="career-result__summary">
      <p class="hub-kicker">Diagnóstico orientativo</p>
      <h3>${escapeHtml(assessment.headline)}</h3>
      <p>${escapeHtml(assessment.interpretation)}</p>
    </div>
    <div class="career-gates">
      ${assessment.gates.map((item) => `<article class="career-gate career-gate--${item.status}"><span>${statusLabels[item.status]}</span><h4>${escapeHtml(item.label)}</h4><p>${escapeHtml(item.next)}</p></article>`).join("")}
    </div>
    <div class="career-warnings"><strong>Límites de esta lectura</strong><ul>${assessment.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>`;
}

function renderPriorities() {
  document.querySelector("#careerPriorities").innerHTML = assessment.priorities.map((action, index) => `
    <li>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <div><p class="career-priority__meta">${escapeHtml(action.domain)} · esfuerzo ${escapeHtml(action.effort)}</p><h3>${escapeHtml(action.title)}</h3><p>${escapeHtml(action.why)}</p><p><strong>Salida:</strong> ${escapeHtml(action.deliverable)}</p><p class="career-stop"><strong>Condición de parada:</strong> ${escapeHtml(action.stop)}</p>${sourceLinks(action.sourceIds)}</div>
    </li>`).join("");
}

function renderRoadmap() {
  document.querySelector("#careerRoadmap").innerHTML = assessment.roadmap.map((phase) => `
    <article><span>${phase.id}</span><h3>${escapeHtml(phase.label)}</h3><ul>${phase.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article>`).join("");
  document.querySelector("#careerWeek").innerHTML = assessment.weeklyAllocation.map((item) => `
    <div class="career-week__row"><span>${escapeHtml(item.label)}</span><div><i style="--share:${item.percent}%"></i></div><strong>${formatNumber(item.hours)} h</strong></div>`).join("");
}

function updateOpportunity() {
  const data = Object.fromEntries(new FormData(document.querySelector("#opportunityForm")));
  const result = evaluateOpportunity(data);
  const explanations = {
    prioritize: "Tiene retorno estratégico suficiente. Define aun así responsable, resultado, horas máximas y fecha de cierre.",
    condition: "No aceptes la versión abierta: reduce alcance, limita recurrencia o negocia un resultado que sirva a otra prioridad.",
    decline: "El coste de oportunidad domina. Posponer es una decisión de carrera, no falta de colaboración."
  };
  document.querySelector("#opportunityResult").className = `opportunity-result opportunity-result--${result.verdict}`;
  document.querySelector("#opportunityResult").innerHTML = `<span>${result.score}/100</span><div><strong>${result.label}</strong><p>${explanations[result.verdict]}</p><small>Beneficio ${result.benefit} · coste ${result.cost} · heurística personal no oficial</small></div>`;
}

function renderStaticContent() {
  const factStatus = { public: "Público", declared: "Declarado por Jorge", verify: "Verificar" };
  document.querySelector("#careerDeferList").innerHTML = careerData.deferByDefault.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  document.querySelector("#careerFacts").innerHTML = careerData.knownFacts.map((fact) => `
    <article><span>${factStatus[fact.status] ?? "Verificar"}</span><h3>${escapeHtml(fact.label)}</h3><p>${escapeHtml(fact.value)}</p>${sourceLinks(fact.sourceId ? [fact.sourceId] : [])}</article>`).join("");
  document.querySelector("#careerSources").innerHTML = careerData.sources.map((source) => `<li id="fuente-${escapeHtml(source.id)}"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`).join("");
  document.querySelector("#careerReviewed").textContent = `Criterios y enlaces revisados el ${formatDate(careerData.reviewedOn)}. Comprueba si existe una convocatoria posterior antes de actuar.`;
}

function readForm() {
  const values = Object.fromEntries(new FormData(form));
  return { ...values, sexennia: Number(values.sexennia), defendedTheses: Number(values.defendedTheses), weeklyHours: Number(values.weeklyHours) };
}

function writeForm(profile) {
  for (const [name, value] of Object.entries(profile)) {
    const control = form.elements.namedItem(name);
    if (control) control.value = String(value);
  }
}

function loadProfile() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (current) return writeForm({ ...PROFILE_DEFAULTS, ...current });
    const previousKey = PREVIOUS_STORAGE_KEYS.find((key) => localStorage.getItem(key));
    const legacy = previousKey ? JSON.parse(localStorage.getItem(previousKey)) : {};
    writeForm({
      ...PROFILE_DEFAULTS,
      contractEnd: legacy.contractEnd || "",
      contractEndMonth: legacy.contractEndMonth || legacy.contractEnd?.slice(0, 7) || PROFILE_DEFAULTS.contractEndMonth,
      mobility: legacy.mobility || PROFILE_DEFAULTS.mobility,
      teaching: legacy.teaching || PROFILE_DEFAULTS.teaching,
      research: legacy.research || PROFILE_DEFAULTS.research,
      sexennia: legacy.sexennia ?? PROFILE_DEFAULTS.sexennia,
      defendedTheses: legacy.defendedTheses ?? PROFILE_DEFAULTS.defendedTheses,
      weeklyHours: legacy.weeklyHours ?? PROFILE_DEFAULTS.weeklyHours,
      projectRole: legacy.projectRole || PROFILE_DEFAULTS.projectRole
    });
  } catch {
    writeForm(PROFILE_DEFAULTS);
  }
}

function exportPlan() {
  const content = exportCareerRoadmapMarkdown(assessment, careerData, new Date());
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `plan-carrera-jorge-parra-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function sourceLinks(ids) {
  const sources = ids.map((id) => careerData.sources.find((source) => source.id === id)).filter(Boolean);
  if (!sources.length) return "";
  return `<nav class="career-inline-sources" aria-label="Fuentes de esta afirmación">${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`).join("")}</nav>`;
}

function formatDate(value) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(`${value}T12:00:00`)); }
function formatNumber(value) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
