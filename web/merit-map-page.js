import "./site-shell.js";
import meritData from "./data/merit-map.json";
import {
  MERIT_PROFILE_DEFAULTS,
  TRADEOFF_OBJECTIVES,
  assetLeverage,
  calculateMeritScenario,
  calculateTradeoffRanking,
  exportMeritMapMarkdown,
  filterAssets,
  validateMeritMapData
} from "./merit-map-model.js";

const STORAGE_KEY = "uv-merit-map-profile-v1";
const form = document.querySelector("#meritScenarioForm");
const filters = document.querySelector("#meritFilters");
const tradeoffControls = document.querySelector("#meritTradeoffControls");
let scenario;

validateMeritMapData(meritData);
renderBaseline();
renderSystemOptions();
renderTradeoffObjectiveOptions();
renderTradeoffs();
renderTailoredCalls();
renderScorecards();
renderMatrix();
renderSources();
writeForm(loadProfile());
updateScenario();
updateAssets();
initScrollSpy();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateScenario();
  document.querySelector("#meritBlocks").focus({ preventScroll: true });
});
form.addEventListener("input", updateScenario);
filters.addEventListener("input", updateAssets);
tradeoffControls.addEventListener("input", renderTradeoffs);
document.querySelector("#meritReset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  writeForm({ ...MERIT_PROFILE_DEFAULTS, ...meritData.personalBaseline });
  updateScenario();
});
document.querySelector("#meritExport").addEventListener("click", exportMap);

function updateScenario() {
  scenario = calculateMeritScenario(Object.fromEntries(new FormData(form)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenario.profile));
  renderBlocks();
  renderPriorities();
}

function renderBaseline() {
  const cards = [
    { label: "PTU", value: "Favorable", detail: "Puerta de acceso superada; no equivale a plaza ni a CU.", tone: "done" },
    { label: "Investigación CU", value: "1 sexenio", detail: "10 puntos automáticos en 1.2.1; tres cubren su mínimo y cuatro su máximo.", tone: "active" },
    { label: "Experiencia docente CU", value: "1 quinquenio", detail: "Dos quinquenios cubren el mínimo alternativo de experiencia; la calidad docente se evalúa aparte.", tone: "active" },
    { label: "Independencia", value: "GE concedido", detail: "Activo en construcción desde septiembre de 2026; debe dejar equipo y resultados para madurar como mérito.", tone: "active" }
  ];
  document.querySelector("#meritBaseline").innerHTML = cards.map((card) => `
    <article class="merit-baseline__card merit-baseline__card--${card.tone}">
      <span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong><p>${escapeHtml(card.detail)}</p>
    </article>`).join("");
}

function renderBlocks() {
  const container = document.querySelector("#meritBlocks");
  container.tabIndex = -1;
  container.innerHTML = scenario.blocks.map((block) => `
    <article class="merit-block merit-block--${block.id}">
      <div class="merit-block__head"><div><span>Subtotal parcial configurado</span><h3>${escapeHtml(block.label)}</h3></div><strong>${formatNumber(block.subtotal)}<small>/100</small></strong></div>
      <div class="merit-block__track" aria-label="${escapeHtml(block.label)}: ${formatNumber(block.subtotal)} puntos parciales de 100"><i style="--score:${block.subtotal}%"></i><b title="Suficiencia global del bloque: 50/100">50</b></div>
      <p class="merit-block__minimum">${escapeHtml(block.minimumStatus)}</p>
      ${block.components.length ? `<ul>${block.components.map((item) => `<li><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div><span>+${formatNumber(item.points)}</span></li>`).join("")}</ul>` : `<p class="merit-block__empty">No hay equivalencias cuantificables configuradas en este bloque.</p>`}
      <p class="merit-block__caveat">${escapeHtml(block.caveat)}</p>
    </article>`).join("");
  document.querySelector("#meritWarnings").innerHTML = `<strong>Antes de interpretar el número</strong><ul>${scenario.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function renderSystemOptions() {
  const select = document.querySelector("#meritSystemFilter");
  select.append(...meritData.systems.map((system) => option(system.id, system.short)));
}

function updateAssets() {
  const values = Object.fromEntries(new FormData(filters));
  const visible = filterAssets(meritData.assets, values).sort((left, right) => assetLeverage(right) - assetLeverage(left) || left.title.localeCompare(right.title, "es"));
  document.querySelector("#meritFilterStatus").textContent = `${visible.length} de ${meritData.assets.length} activos visibles. “Palanca” cuenta destinos conectados; no son puntos oficiales.`;
  document.querySelector("#meritAssets").innerHTML = visible.map((asset) => `
    <article class="merit-asset" data-domain="${escapeHtml(asset.domain)}">
      <header><span>${escapeHtml(domainLabel(asset.domain))}</span><strong>${assetLeverage(asset)}<small> palancas</small></strong></header>
      <h3>${escapeHtml(asset.title)}</h3>
      <div class="merit-flow"><div><b>Hacer</b><p>${escapeHtml(asset.action)}</p></div><span aria-hidden="true">→</span><div><b>Conservar</b><p>${escapeHtml(asset.evidence)}</p></div></div>
      <div class="merit-relations">${Object.entries(asset.systems).map(([systemId, relation]) => relationChip(systemId, relation)).join("")}</div>
    </article>`).join("");
}

function renderTradeoffObjectiveOptions() {
  const select = document.querySelector("#meritTradeoffObjective");
  select.append(...Object.entries(TRADEOFF_OBJECTIVES).map(([id, objective]) => option(id, objective.label)));
}

function renderTradeoffs() {
  const settings = Object.fromEntries(new FormData(tradeoffControls));
  const tradeoffs = calculateTradeoffRanking(meritData.tradeoffOptions, settings);
  const summary = document.querySelector("#meritTradeoffSummary");
  summary.innerHTML = `
    <article class="merit-tradeoff-summary__primary">
      <span>Mayor encaje estratégico con este supuesto</span>
      <strong>${escapeHtml(tradeoffs.primary?.title ?? "Sin rutas")}</strong>
      ${tradeoffs.primary ? `<b class="merit-summary-capacity">Capacidad: ${escapeHtml(capacityLabel(tradeoffs.primary.capacityState))} · ${tradeoffs.primary.effortMin}–${tradeoffs.primary.effortMax} h/semana de pico</b>` : ""}
      <p>${escapeHtml(tradeoffs.primary?.nextAction ?? "")}</p>
    </article>
    <article>
      <span>Complemento que no duplica frente</span>
      <strong>${escapeHtml(tradeoffs.complement?.title ?? "Ninguno con la capacidad indicada")}</strong>
      <p>${tradeoffs.overloadCount ? `${tradeoffs.overloadCount} rutas no caben en ${tradeoffs.capacityHours} h/semana de pico sin sustituir otra actividad.` : "Todas las rutas caben individualmente en la capacidad declarada; no significa que quepan simultáneamente."}</p>
    </article>`;

  document.querySelector("#meritTradeoffPanels").innerHTML = tradeoffs.routes.map((route, index) => `
    <article class="merit-tradeoff-card merit-tradeoff-card--${escapeHtml(route.capacityState)}">
      <header>
        <div><span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(route.eyebrow)}</span><h3>${escapeHtml(route.title)}</h3></div>
        <div class="merit-tradeoff-index"><strong>${formatNumber(route.priorityIndex)}</strong><small>/5 encaje</small></div>
      </header>
      <p class="merit-tradeoff-card__summary">${escapeHtml(route.summary)}</p>
      <div class="merit-tradeoff-capacity">
        <span class="merit-capacity-badge merit-capacity-badge--${escapeHtml(route.capacityState)}">${escapeHtml(capacityLabel(route.capacityState))}</span>
        <strong>${route.effortMin}–${route.effortMax} h/semana de pico</strong>
        <small>${escapeHtml(route.horizon)}</small>
      </div>
      <div class="merit-tradeoff-ledger">
        <section aria-label="Valor estratégico estimado">
          <div class="merit-ledger-title"><h4>Qué impulsa</h4><strong>${formatNumber(route.strategicValue)}/5</strong></div>
          ${tradeoffBar("CU", route.benefits.cu, "benefit")}
          ${tradeoffBar("Financiación", route.benefits.funding, "benefit")}
          ${tradeoffBar("Independencia", route.benefits.independence, "benefit")}
          ${tradeoffBar("Transferencia", route.benefits.transfer, "benefit")}
          ${tradeoffBar("Internacionalización", route.benefits.international, "benefit")}
        </section>
        <section aria-label="Carga estimada">
          <div class="merit-ledger-title"><h4>Qué exige</h4><strong>${formatNumber(route.burden)}/5</strong></div>
          ${tradeoffBar("Tiempo", route.burdens.time, "burden")}
          ${tradeoffBar("Incertidumbre", route.burdens.uncertainty, "burden")}
          ${tradeoffBar("Dependencia externa", route.burdens.dependency, "burden")}
          ${tradeoffBar("Preparación actual", route.readiness, "readiness")}
        </section>
      </div>
      <dl class="merit-tradeoff-notes">
        <div><dt>Coste de oportunidad</dt><dd>${escapeHtml(route.tradeoff)}</dd></div>
        <div><dt>Activar solo si</dt><dd>${escapeHtml(route.gate)}</dd></div>
        <div><dt>Siguiente paso reversible</dt><dd>${escapeHtml(route.nextAction)}</dd></div>
      </dl>
      <footer>${sourceLinks(route.sourceIds)}</footer>
    </article>`).join("");
}

function tradeoffBar(label, value, tone) {
  return `<div class="merit-tradeoff-bar merit-tradeoff-bar--${tone}"><div><span>${escapeHtml(label)}</span><b>${value}/5</b></div><i aria-hidden="true"><span style="--level:${Number(value) * 20}%"></span></i></div>`;
}

function renderScorecards() {
  document.querySelector("#meritScorecards").innerHTML = meritData.callScorecards.map((card) => `
    <article class="merit-scorecard">
      <header><div><span>${escapeHtml(card.edition)}</span><h3>${escapeHtml(card.label)}</h3></div>${sourceLinks(card.sourceIds)}</header>
      <div class="merit-scorecard__parts">${card.parts.map((part) => `
        <div class="merit-score-row">
          <div><span>${escapeHtml(part.label)}</span><strong>${part.value}</strong></div>
          <div class="merit-score-track"><i style="--weight:${part.value}%"></i>${part.threshold ? `<b style="--threshold:${part.threshold}%" title="Umbral ${part.threshold}"></b>` : ""}</div>
          <small>${part.threshold ? `Umbral ${part.threshold}/${part.value}` : part.detail ? escapeHtml(part.detail) : "Sin umbral específico mostrado"}</small>
        </div>`).join("")}</div>
    </article>`).join("");
}

function renderTailoredCalls() {
  document.querySelector("#meritTailoredCalls").innerHTML = meritData.tailoredCalls.map((call, index) => `
    <article class="merit-tailored-call ${index < 3 ? "merit-tailored-call--priority" : ""}">
      <header>
        <div><span>${escapeHtml(call.level)}</span><h3>${escapeHtml(call.title)}</h3><code>${escapeHtml(call.code)}</code></div>
        <div class="merit-fit-score" aria-label="Afinidad personal ${call.fit} de 5"><strong>${call.fit}</strong><small>/5</small></div>
      </header>
      <div class="merit-tailored-call__meta"><span>${escapeHtml(call.fitLabel)}</span><span>${escapeHtml(call.window)}</span><span>${escapeHtml(call.instrument)}</span></div>
      <div class="merit-tailored-call__body">
        <div><h4>Por qué encaja</h4><p>${escapeHtml(call.whyFit)}</p><p><strong>Papel razonable:</strong> ${escapeHtml(call.role)}</p></div>
        <div><h4>Necesita antes</h4><ul>${call.requiredBefore.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
        <div><h4>Qué mérito puede dejar</h4><ul>${call.creates.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </div>
      <footer><strong>Decisión</strong><p>${escapeHtml(call.decision)}</p>${sourceLinks(call.sourceIds)}</footer>
    </article>`).join("");
}

function renderMatrix() {
  const systems = meritData.systems;
  const legend = { points: "P", "points-choice": "P*", weighted: "W", evidence: "E", portfolio: "C", eligibility: "R", target: "O" };
  document.querySelector("#meritMatrix").innerHTML = `
    <caption>P = puntos; P* = elegir bloque; W = criterio ponderado; E = evidencia; C = cartera; R = requisito/elegibilidad; O = objetivo.</caption>
    <thead><tr><th scope="col">Activo</th>${systems.map((system) => `<th scope="col"><span>${escapeHtml(system.short)}</span></th>`).join("")}</tr></thead>
    <tbody>${meritData.assets.map((asset) => `<tr><th scope="row">${escapeHtml(asset.title)}</th>${systems.map((system) => {
      const relation = asset.systems?.[system.id];
      return relation ? `<td><abbr title="${escapeHtml(meritData.relationLabels[relation])}">${legend[relation]}</abbr></td>` : "<td><span aria-label=\"Sin relación directa documentada\">—</span></td>";
    }).join("")}</tr>`).join("")}</tbody>`;
}

function renderPriorities() {
  document.querySelector("#meritPriorities").innerHTML = scenario.priorities.map((item, index) => `
    <li><span>${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reason)}</p></div></li>`).join("");
}

function renderSources() {
  document.querySelector("#meritSources").innerHTML = meritData.sources.map((source) => `<li id="fuente-${escapeHtml(source.id)}"><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a></li>`).join("");
  document.querySelector("#meritReviewed").textContent = `Revisión: ${formatDate(meritData.reviewedOn)}. Antes de presentar una solicitud, abre la convocatoria y la edición vigentes: los baremos y ventanas de elegibilidad pueden cambiar.`;
}

function relationChip(systemId, relation) {
  const system = meritData.systems.find((item) => item.id === systemId);
  return `<span class="merit-relation merit-relation--${escapeHtml(relation)}"><b>${escapeHtml(system?.short ?? systemId)}</b><small>${escapeHtml(meritData.relationLabels[relation] ?? relation)}</small></span>`;
}

function sourceLinks(sourceIds = []) {
  return `<div class="merit-source-links">${sourceIds.map((id) => {
    const source = meritData.sources.find((item) => item.id === id);
    return source ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Fuente</a>` : "";
  }).join("")}</div>`;
}

function loadProfile() {
  const fallback = { ...MERIT_PROFILE_DEFAULTS, ...meritData.personalBaseline };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }; }
  catch { return fallback; }
}

function writeForm(profile) {
  for (const [key, value] of Object.entries(profile)) {
    const control = form.elements.namedItem(key);
    if (control) control.value = String(value);
  }
}

function exportMap() {
  const markdown = exportMeritMapMarkdown(scenario, meritData);
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `mapa-meritos-${new Date().toISOString().slice(0, 10)}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function initScrollSpy() {
  const links = [...document.querySelectorAll(".merit-jump a")];
  const byId = new Map(links.map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
    if (!visible.length) return;
    for (const link of links) link.removeAttribute("aria-current");
    const current = byId.get(visible[0].target.id);
    current?.setAttribute("aria-current", "location");
  }, { rootMargin: "-35% 0px -55% 0px", threshold: 0 });
  for (const id of byId.keys()) observer.observe(document.getElementById(id));
}

function option(value, label) { const element = document.createElement("option"); element.value = value; element.textContent = label; return element; }
function capacityLabel(state) { return ({ comfortable: "Cabe con margen", tight: "Cabe justo", overload: "Exige sustituir" })[state] ?? state; }
function domainLabel(domain) { return ({ investigacion: "Investigación", financiacion: "Financiación", liderazgo: "Liderazgo", transferencia: "Transferencia", docencia: "Docencia", gestion: "Gestión" })[domain] ?? domain; }
function formatNumber(value) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value); }
function formatDate(value) { return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" }).format(new Date(`${value}T12:00:00+02:00`)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
