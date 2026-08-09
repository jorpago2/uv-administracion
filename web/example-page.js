import manualData from "./data/manual.json";
import operationsData from "./data/operations.json";
import situationsData from "./data/situations.json";
import situationsExtensionData from "./data/situations-51-100.json";
import { CATEGORIES } from "./chapter-categories.js";
import { buildExampleGuides, findExampleGuide } from "./example-guide-model.js";
import { buildSituationGuides, combineSituationCatalogs, findSituationGuide } from "./situation-model.js";

const elements = {
  loading: document.querySelector("#exampleLoading"),
  guide: document.querySelector("#exampleGuide"),
  error: document.querySelector("#exampleError")
};
const guides = buildExampleGuides(manualData.markdown, operationsData.procedures);
const situationGuides = buildSituationGuides(combineSituationCatalogs(situationsData, situationsExtensionData), guides);
const parameters = new URLSearchParams(window.location.search);
const situationId = parameters.get("caso");
const chapterNumber = parameters.get("capitulo");
const guide = situationId ? findSituationGuide(situationGuides, situationId) : findExampleGuide(guides, chapterNumber);
const activeGuides = situationId ? situationGuides : guides;

if (guide) renderGuide(guide);
else renderError();

function renderGuide(item) {
  const category = CATEGORIES.find((candidate) => candidate.sections.includes(item.chapterNumber));
  document.title = `${item.title} · Guía paso a paso UV`;
  document.querySelector('meta[name="description"]').content = `${item.title}: orientación detallada, documentos, pasos, controles y fuentes oficiales.`;

  const breadcrumb = el("nav", "breadcrumb");
  breadcrumb.setAttribute("aria-label", "Migas de pan");
  if (item.situationNumber) {
    breadcrumb.append(link("Situaciones", "resolver/"), text(" / "), link(`Situación ${item.situationNumber}`, `example.html?caso=${encodeURIComponent(item.id)}`), text(" / "), link(`Capítulo ${item.chapterNumber}`, `manual/#${item.chapterSlug}`));
  } else breadcrumb.append(link("Manual", "manual/"), text(" / "), link(`Capítulo ${item.chapterNumber}`, `manual/#${item.chapterSlug}`));

  const hero = el("header", "guide-hero");
  const heroCopy = el("div", "guide-hero__copy");
  heroCopy.append(
    paragraph(item.situationNumber ? `${item.categoryLabel} · Situación ${String(item.situationNumber).padStart(2, "0")}` : `${category?.shortLabel ?? "Guía operativa"} · Capítulo ${item.chapterNumber}`, "eyebrow"),
    heading(1, item.title),
    paragraph(item.scenario, "guide-hero__summary")
  );
  const actions = el("div", "guide-actions");
  actions.append(button("Imprimir / guardar PDF", "printGuide"), button("Copiar correo inicial", "copyEmail"));
  hero.append(heroCopy, actions);

  const caution = el("aside", "personal-caution");
  caution.append(strong("Qué es esta página"), text(" Una orientación operativa para una persona que empieza desde cero. Las recomendaciones de organización no son reglas oficiales y no garantizan una resolución favorable."));

  const facts = el("dl", "guide-facts");
  fact(facts, "Resultado buscado", item.outcome);
  fact(facts, "Primera unidad", item.unit);
  fact(facts, "Plazo crítico", item.deadline);
  fact(facts, "Canal orientativo", item.channel);

  const layout = el("div", "guide-layout");
  const navigation = renderNavigation();
  const content = el("div", "guide-content");
  content.append(
    renderOrientation(item),
    renderTransferability(item),
    renderResponsibilities(item),
    renderPreparation(item),
    renderRoute(item),
    renderTimeline(item),
    renderCommunication(item),
    renderChecklist(item),
    renderProblems(item),
    renderSources(item),
    renderRelatedNavigation(item)
  );
  layout.append(navigation, content);

  elements.guide.replaceChildren(breadcrumb, hero, caution, facts, layout);
  elements.loading.hidden = true;
  elements.guide.hidden = false;
  bindInteractions(item);
  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    window.requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
  }
}

function renderNavigation() {
  const aside = el("aside", "guide-index");
  const title = heading(2, "Ruta de trabajo");
  const nav = el("nav");
  nav.setAttribute("aria-label", "Secciones de la guía");
  const list = el("ol");
  [
    ["orientacion", "1. Entender el caso"], ["transferibilidad", "2. Saber cuándo sirve"], ["responsabilidades", "3. Saber quién hace qué"],
    ["preparacion", "4. Prepararlo"], ["ruta", "5. Ejecutarlo"], ["calendario", "6. Controlar tiempos"], ["comunicacion", "7. Pedir ayuda"],
    ["control", "8. Verificar"], ["bloqueos", "9. Resolver bloqueos"], ["fuentes", "10. Consultar fuentes"]
  ].forEach(([id, label]) => {
    const item = el("li");
    item.append(link(label, `#${id}`));
    list.append(item);
  });
  nav.append(list);
  aside.append(title, nav);
  return aside;
}

function renderOrientation(item) {
  const section = guideSection("orientacion", "1. Entender el caso antes de actuar", "Orientación");
  section.append(callout("Meta operativa", item.outcome, "accent"));
  section.append(heading(3, "Las tres preguntas que debes poder responder"), list(item.questions));
  if (item.decisionRules?.length) section.append(heading(3, "Reglas para decidir la ruta"), list(item.decisionRules, "decision-rule-list"));
  section.append(recommendation("No empieces por el formulario. Empieza delimitando hechos, plazo y órgano competente; un formulario correcto enviado al cauce equivocado sigue siendo un problema."));
  appendSourceNote(section, item.sources);
  return section;
}

function renderTransferability(item) {
  const section = guideSection("transferibilidad", "2. Saber si este ejemplo te sirve", "Cómo reutilizarlo");
  section.append(paragraph("No necesitas encontrar un caso idéntico. Comprueba qué elementos administrativos coinciden, sustituye las variables indicadas y detente si aparece alguna condición que cambie la ruta."));
  const grid = el("div", "transferability-grid");
  [
    ["También te sirve para", item.alsoApplies, "also"],
    ["Qué debes adaptar", item.adapt, "adapt"],
    ["Deja de servir cuando", item.stopsApplying, "stop"]
  ].forEach(([title, body, modifier]) => {
    const card = el("article", `transferability-card transferability-card--${modifier}`);
    card.append(heading(3, title), paragraph(body));
    grid.append(card);
  });
  section.append(grid, recommendation("Si dudas entre dos rutas, no elijas por semejanza superficial: confirma el objeto, el importe, el plazo, la unidad competente y la fuente vigente."));
  return section;
}

function renderResponsibilities(item) {
  const section = guideSection("responsabilidades", "3. Saber quién hace qué", "Responsabilidades");
  section.append(paragraph("Separa siempre iniciativa, tramitación, autorización y ejecución. Una misma persona puede asumir varios papeles, pero cada actuación necesita la competencia y la evidencia correspondientes."));
  const table = el("div", "responsibility-table");
  table.setAttribute("role", "table");
  table.setAttribute("aria-label", "Mapa de responsabilidades del caso");
  const header = el("div", "responsibility-row responsibility-row--header");
  header.setAttribute("role", "row");
  header.append(tableCell("Quién", "columnheader"), tableCell("Qué le corresponde", "columnheader"));
  table.append(header);
  item.responsibilities.forEach((responsibility) => {
    const row = el("div", "responsibility-row");
    row.setAttribute("role", "row");
    row.append(tableCell(responsibility.actor), tableCell(responsibility.task));
    table.append(row);
  });
  section.append(table, callout("No des por supuesto", item.doNotAssume, "warning"));
  appendSourceNote(section, item.sources);
  return section;
}

function renderPreparation(item) {
  const section = guideSection("preparacion", "4. Preparar un expediente que otra persona pueda entender", "Antes de empezar");
  section.append(callout("Primer movimiento", item.firstMove, "secondary"));
  section.append(heading(3, "Carpeta de trabajo recomendada"));
  const tree = el("div", "folder-tree");
  ["00_plazo-y-fuente", "01_borradores", "02_anexos-y-evidencias", "03_presentado", "04_respuestas-y-resolucion"].forEach((name) => tree.append(code(name)));
  section.append(tree, paragraph("Usa nombres con fecha ISO, por ejemplo 2026-09-14_solicitud_v03.pdf. Conserva como inmutable la versión finalmente registrada.", "practical-note"));
  section.append(heading(3, "Documentación que conviene reunir"), checklistList(item.documents, "prep"));
  appendSourceNote(section, item.sources);
  return section;
}

function renderRoute(item) {
  const section = guideSection("ruta", "5. Ruta paso a paso", "Ejecución");
  const steps = detailedSteps(item);
  const listElement = el("ol", "route-steps");
  steps.forEach((step, index) => {
    const entry = el("li");
    const number = el("span", "route-step__number");
    number.textContent = String(index + 1).padStart(2, "0");
    const body = el("div");
    body.append(heading(3, step.title), paragraph(step.body));
    const evidence = paragraph(`Evidencia a conservar: ${step.evidence}`, "evidence-note");
    body.append(evidence);
    entry.append(number, body);
    listElement.append(entry);
  });
  section.append(listElement, recommendation("Si una unidad te indica una ruta distinta, pide que identifique el trámite o instrucción vigente y conserva esa respuesta con el expediente."));
  appendSourceNote(section, item.sources);
  return section;
}

function renderTimeline(item) {
  const section = guideSection("calendario", "6. Calendario de control", "Plazos");
  section.append(callout("Regla que prevalece", item.deadline, "warning"));
  const timeline = el("ol", "timeline");
  [
    ["En cuanto detectes la necesidad", "Abre la carpeta, guarda la fuente vigente, anota el plazo y ejecuta el primer movimiento."],
    ["Antes de redactar la versión final", "Confirma unidad, canal, firma, anexos y si existe un cierre interno anterior al externo."],
    ["El día de la presentación", "Revisa destinatario, archivos y firma; registra con margen y descarga inmediatamente el justificante."],
    ["Durante la tramitación", "Revisa sede, notificaciones y correo institucional. Responde dentro del expediente cuando haya subsanación."],
    ["Al cerrar", "Archiva resolución, versión aprobada, costes y obligaciones futuras; actualiza tu calendario si quedan hitos."]
  ].forEach(([when, action]) => {
    const entry = el("li");
    entry.append(strong(when), paragraph(action));
    timeline.append(entry);
  });
  section.append(timeline);
  return section;
}

function renderCommunication(item) {
  const section = guideSection("comunicacion", "7. Correo inicial para no empezar por el sitio equivocado", "Comunicación");
  section.append(paragraph("Este texto es una plantilla de consulta, no sustituye la presentación formal. Complétalo con datos mínimos y no incluyas información sensible innecesaria."));
  const template = el("pre", "email-template");
  template.id = "emailTemplate";
  template.textContent = buildEmail(item);
  section.append(template, button("Copiar este texto", "copyEmailInline"));
  return section;
}

function renderChecklist(item) {
  const section = guideSection("control", "8. Control final antes de darlo por resuelto", "Verificación");
  const toolbar = el("div", "checklist-toolbar");
  const progress = paragraph("0 elementos completados", "checklist-progress");
  progress.id = "checklistProgress";
  progress.setAttribute("aria-live", "polite");
  toolbar.append(progress, button("Reiniciar lista", "resetChecklist"));
  section.append(toolbar, heading(3, "Comprobaciones de éxito"), checklistList(item.successChecks, "success"));
  section.append(heading(3, "Trazabilidad mínima"), checklistList([
    "He consultado una fuente oficial vigente y guardado el enlace o PDF.",
    "Sé quién es la unidad competente y qué canal exige.",
    "He registrado o enviado la versión correcta y conservo justificante.",
    "He anotado el siguiente hito y quién debe actuar.",
    "No doy el expediente por cerrado sin resolución, conformidad o evidencia equivalente."
  ], "trace"));
  return section;
}

function renderProblems(item) {
  const section = guideSection("bloqueos", "9. Errores frecuentes y qué hacer si te bloqueas", "Contingencias");
  section.append(heading(3, "No hagas esto"), list(item.risks, "risk-list"));
  if (item.stopConditions?.length) section.append(heading(3, "Detente y confirma antes de continuar"), list(item.stopConditions, "stop-list"));
  const grid = el("div", "blocker-grid");
  [
    ["No sé qué unidad es competente", "Envía una consulta breve con el objetivo, el capítulo y la fecha límite. Pide derivación expresa si no corresponde."],
    ["La sede falla cerca del plazo", "Guarda capturas con fecha y hora, abre incidencia y utiliza otro registro válido solo si la norma lo permite. La avería no prorroga automáticamente."],
    ["Recibo instrucciones contradictorias", "Solicita confirmación escrita, identifica la norma o convocatoria y aplica la fuente de mayor rango o la unidad competente."],
    ["No llega respuesta", "Haz seguimiento citando expediente y fecha. Si el plazo corre, registra la actuación que corresponda sin sustituirla por recordatorios informales."]
  ].forEach(([title, body]) => {
    const card = el("article");
    card.append(heading(3, title), paragraph(body));
    grid.append(card);
  });
  section.append(grid);
  if (item.escalation?.length) section.append(heading(3, "Cómo escalar sin perder trazabilidad"), list(item.escalation, "escalation-list"));
  return section;
}

function renderSources(item) {
  const section = guideSection("fuentes", "10. Fuentes oficiales que debes abrir", "Base documental");
  section.append(paragraph(`Fuentes recopiladas o revisadas en la actualización ${formatDate(manualData.meta.fecha_revision)}. Comprueba siempre si existe una versión posterior.`));
  const listElement = el("ul", "source-list");
  item.sources.forEach((source, index) => {
    const entry = el("li");
    const sourceLink = link(source.label || `Fuente oficial ${index + 1}`, source.url);
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    entry.append(sourceLink, paragraph(new URL(source.url).hostname));
    listElement.append(entry);
  });
  section.append(listElement, recommendation("Las frases de organización, las carpetas y los modelos de correo son recomendaciones operativas de esta web. Los plazos, competencias y requisitos deben confirmarse en estas fuentes y en la resolución o convocatoria aplicable."));
  return section;
}

function renderRelatedNavigation(item) {
  const section = el("nav", "guide-pagination");
  section.setAttribute("aria-label", "Otros ejemplos");
  const index = activeGuides.findIndex((guide) => item.situationNumber ? guide.id === item.id : guide.chapterNumber === item.chapterNumber);
  const previous = activeGuides[index - 1];
  const next = activeGuides[index + 1];
  const guideHref = (guide) => guide.situationNumber ? `example.html?caso=${encodeURIComponent(guide.id)}` : `example.html?capitulo=${guide.chapterNumber}`;
  if (previous) section.append(link(`← ${previous.title}`, guideHref(previous)));
  section.append(link("Volver al capítulo", `manual/#${item.chapterSlug}`));
  if (next) section.append(link(`${next.title} →`, guideHref(next)));
  return section;
}

function detailedSteps(item) {
  const procedureActions = item.steps.map((step) => typeof step === "string"
    ? { title: step, body: "Completa esta acción y resuelve cualquier duda antes de pasar a la siguiente fase.", evidence: "documento, correo o anotación fechada que acredite el avance" }
    : { title: step.action, body: step.detail || "Completa esta acción antes de pasar a la siguiente fase.", evidence: step.evidence });
  return [
    { title: "Delimita la situación y evita acciones irreversibles", body: item.firstMove, evidence: "nota de una página con hechos, fechas, objetivo y primera fuente consultada" },
    { title: "Confirma unidad, canal y plazo", body: `Contrasta la ruta con ${item.unit}. El canal orientativo es: ${item.channel}.`, evidence: "enlace del trámite o respuesta escrita de la unidad" },
    { title: "Prepara una versión revisable", body: "Reúne los documentos de la lista, utiliza nombres inequívocos y revisa que todas las fechas, personas e importes coincidan.", evidence: "carpeta de borradores y lista de control completada" },
    ...procedureActions,
    { title: "Presenta con margen y congela la versión enviada", body: "Usa el cauce exigido, verifica destinatario y anexos y no modifiques después el archivo que guardes como presentado.", evidence: "justificante, huella o copia del mensaje institucional con sus adjuntos" },
    { title: "Sigue el expediente hasta un cierre verificable", body: "Anota el siguiente responsable y fecha, revisa notificaciones y archiva la resolución o conformidad final junto con las obligaciones posteriores.", evidence: "resolución, conformidad, acta o registro de cierre" }
  ];
}

function bindInteractions(item) {
  const storageKey = `uv-example-progress:${item.situationNumber ? item.id : item.chapterNumber}`;
  const checkboxes = [...document.querySelectorAll('[data-guide-check="true"]')];
  const saved = readProgress(storageKey);
  checkboxes.forEach((checkbox) => {
    checkbox.checked = saved.includes(checkbox.id);
    checkbox.addEventListener("change", () => {
      writeProgress(storageKey, checkboxes.filter((candidate) => candidate.checked).map((candidate) => candidate.id));
      updateProgress(checkboxes);
    });
  });
  updateProgress(checkboxes);
  document.querySelector("#resetChecklist")?.addEventListener("click", () => {
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    writeProgress(storageKey, []);
    updateProgress(checkboxes);
  });
  document.querySelector("#printGuide")?.addEventListener("click", () => window.print());
  ["#copyEmail", "#copyEmailInline"].forEach((selector) => document.querySelector(selector)?.addEventListener("click", async (event) => {
    try {
      await copyText(document.querySelector("#emailTemplate").textContent);
      temporaryLabel(event.currentTarget, "Copiado");
    } catch { temporaryLabel(event.currentTarget, "No se pudo copiar"); }
  }));
}

function checklistList(items, prefix) {
  const listElement = el("ul", "working-checklist");
  items.forEach((item, index) => {
    const entry = el("li");
    const label = el("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `check-${prefix}-${index}`;
    checkbox.dataset.guideCheck = "true";
    label.append(checkbox, text(item));
    entry.append(label);
    listElement.append(entry);
  });
  return listElement;
}

function appendSourceNote(container, sources) {
  if (!sources.length) return;
  const note = el("p", "source-note");
  note.append(strong("Contrasta con: "));
  sources.slice(0, 2).forEach((source, index) => {
    if (index) note.append(text(" · "));
    const sourceLink = link(source.label, source.url);
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    note.append(sourceLink);
  });
  container.append(note);
}

function guideSection(id, title, eyebrow) {
  const section = el("section", "guide-section");
  section.id = id;
  section.append(paragraph(eyebrow, "eyebrow"), heading(2, title));
  return section;
}

function callout(label, body, variant) {
  const aside = el("aside", `guide-callout guide-callout--${variant}`);
  aside.append(strong(label), paragraph(body));
  return aside;
}

function recommendation(body) {
  const aside = el("aside", "recommendation");
  aside.append(strong("Recomendación operativa de esta guía"), paragraph(body));
  return aside;
}

function fact(listElement, label, value) {
  const wrapper = el("div");
  const term = el("dt");
  term.textContent = label;
  const description = el("dd");
  description.textContent = value;
  wrapper.append(term, description);
  listElement.append(wrapper);
}

function tableCell(value, role = "cell") {
  const node = el("div", "responsibility-cell");
  node.setAttribute("role", role);
  node.textContent = value;
  return node;
}

function buildEmail(item) {
  return `Asunto: Consulta previa · ${item.title}\n\nBuenos días:\n\nSoy PDI de la Universitat de València y estoy preparando esta actuación: ${item.title}.\n\nSituación resumida:\n${item.scenario}\n\nAntes de iniciarla, agradecería que me confirmaseis:\n1. si esta es la unidad competente;\n2. el trámite o canal que debo utilizar;\n3. el plazo y los anexos obligatorios;\n4. si debo obtener alguna autorización antes de actuar.\n\nFecha o hito que condiciona el caso: [COMPLETAR].\nDocumentación que ya tengo: [COMPLETAR].\n\nMuchas gracias.\n\nJorge Parra\nDepartamento de Ingeniería Electrónica · Universitat de València`;
}

function updateProgress(checkboxes) {
  const completed = checkboxes.filter((checkbox) => checkbox.checked).length;
  const progress = document.querySelector("#checklistProgress");
  if (progress) progress.textContent = `${completed} de ${checkboxes.length} elementos completados`;
}

function readProgress(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function writeProgress(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* La guía sigue funcionando sin persistencia. */ } }
async function copyText(value) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value); throw new Error("Portapapeles no disponible"); }
function temporaryLabel(control, label) { const original = control.textContent; control.textContent = label; window.setTimeout(() => { control.textContent = original; }, 1800); }
function formatDate(value) { const date = /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? new Date(`${value}T12:00:00`) : null; return date ? new Intl.DateTimeFormat("es-ES").format(date) : "sin fecha disponible"; }

function renderError() { elements.loading.hidden = true; elements.error.hidden = false; }
function el(tag, className = "") { const node = document.createElement(tag); if (className) node.className = className; return node; }
function text(value) { return document.createTextNode(value); }
function heading(level, value) { const node = el(`h${level}`); node.textContent = value; return node; }
function paragraph(value, className = "") { const node = el("p", className); node.textContent = value; return node; }
function strong(value) { const node = el("strong"); node.textContent = value; return node; }
function code(value) { const node = el("code"); node.textContent = value; return node; }
function button(value, id) { const node = el("button", "action-button"); node.type = "button"; node.id = id; node.textContent = value; return node; }
function link(value, href) { const node = el("a"); node.href = href; node.textContent = value; return node; }
function list(items, className = "") { const node = el("ul", className); items.forEach((value) => { const item = el("li"); item.textContent = value; node.append(item); }); return node; }
