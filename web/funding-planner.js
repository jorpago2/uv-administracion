import fundingData from "./data/funding-calls.json";
import { BUDGET_PRESETS, getRulePackage } from "./funding-planner-data.js";
import { buildApplicationPlan, buildPlanIcs, buildPlanMarkdown, evaluateEligibility } from "./funding-planner-model.js";
import { FUNDING_LEVELS, formatIsoDate, validateFundingData } from "./funding-explorer-model.js";

export function initFundingPlanner(root, options = {}) {
  if (!root) throw new Error("No se encontró el planificador de candidaturas.");
  const data = validateFundingData(fundingData);
  const elements = getElements(root);
  assertElements(elements);
  const state = { eligibility: null, plan: null, call: null };

  populateCalls(elements.call, data.calls);
  elements.call.value = "erc-starting";
  renderRuleForm(elements, data.calls, state);

  elements.call.addEventListener("change", () => {
    state.eligibility = null;
    state.plan = null;
    renderRuleForm(elements, data.calls, state);
    resetOutput(elements);
  });
  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    generate(elements, data.calls, state);
  });
  elements.form.addEventListener("reset", () => {
    window.setTimeout(() => {
      elements.call.value = "erc-starting";
      renderRuleForm(elements, data.calls, state);
      resetOutput(elements);
    });
  });
  elements.downloadMarkdown.addEventListener("click", () => downloadPlan("markdown", state));
  elements.downloadIcs.addEventListener("click", () => downloadPlan("ics", state));
  elements.openBudget.addEventListener("click", () => applyBudgetPreset(elements, state, options.budgetHref));
  root.addEventListener("funding:select", (event) => {
    if (!data.calls.some((call) => call.id === event.detail?.callId)) return;
    elements.call.value = event.detail.callId;
    renderRuleForm(elements, data.calls, state);
    resetOutput(elements);
    elements.section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => elements.call.focus({ preventScroll: true }), 350);
  });
}

function getElements(root) {
  const section = root.querySelector("#preparador-candidatura");
  const form = root.querySelector("#fundingPlannerForm");
  return {
    root,
    section,
    form,
    call: form?.elements.callId,
    projectTitle: form?.elements.projectTitle,
    role: form?.elements.role,
    externalDeadline: form?.elements.externalDeadline,
    internalDeadline: form?.elements.internalDeadline,
    ruleTitle: root.querySelector("#fundingRuleTitle"),
    ruleMeta: root.querySelector("#fundingRuleMeta"),
    ruleCaveat: root.querySelector("#fundingRuleCaveat"),
    questions: root.querySelector("#fundingEligibilityQuestions"),
    output: root.querySelector("#fundingPlanOutput"),
    resultBadge: root.querySelector("#fundingEligibilityBadge"),
    resultSummary: root.querySelector("#fundingEligibilitySummary"),
    resultChecks: root.querySelector("#fundingEligibilityChecks"),
    timelineBody: root.querySelector("#fundingTimelineBody"),
    checklist: root.querySelector("#fundingPlanChecklist"),
    risks: root.querySelector("#fundingPlanRisks"),
    source: root.querySelector("#fundingPlannerSource"),
    downloadMarkdown: root.querySelector("#downloadFundingPlanMarkdown"),
    downloadIcs: root.querySelector("#downloadFundingPlanIcs"),
    openBudget: root.querySelector("#openFundingBudget")
  };
}

function assertElements(elements) {
  const missing = Object.entries(elements).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Faltan controles del planificador: ${missing.join(", ")}.`);
}

function populateCalls(select, calls) {
  const fragment = document.createDocumentFragment();
  Object.keys(FUNDING_LEVELS).forEach((level) => {
    const groupCalls = calls.filter((call) => call.level === level).sort((a, b) => a.shortName.localeCompare(b.shortName, "es"));
    if (!groupCalls.length) return;
    const group = document.createElement("optgroup");
    group.label = FUNDING_LEVELS[level];
    groupCalls.forEach((call) => {
      const option = document.createElement("option");
      option.value = call.id;
      option.textContent = `${call.shortName} · ${call.name}`;
      group.append(option);
    });
    fragment.append(group);
  });
  select.replaceChildren(fragment);
}

function renderRuleForm(elements, calls, state) {
  const call = calls.find((item) => item.id === elements.call.value) || calls[0];
  const rulePackage = getRulePackage(call.id);
  state.call = call;
  elements.ruleTitle.textContent = rulePackage.title;
  elements.ruleMeta.textContent = `${rulePackage.editionReference} · revisado ${formatIsoDate(rulePackage.verifiedOn)}`;
  elements.ruleCaveat.textContent = rulePackage.caveat;
  elements.questions.replaceChildren(...rulePackage.questions.map(createQuestion));
  const preset = BUDGET_PRESETS[call.id];
  elements.openBudget.disabled = !preset;
  elements.openBudget.textContent = preset ? "Enviar base a presupuesto" : "Sin preajuste presupuestario fiable";
}

function createQuestion(question) {
  const label = document.createElement("label");
  label.className = "funding-planner__question";
  const text = document.createElement("span");
  text.textContent = question.label;
  const control = question.type === "select" ? document.createElement("select") : document.createElement("input");
  control.name = `eligibility_${question.id}`;
  control.dataset.answerId = question.id;
  if (question.type === "select") {
    question.options.forEach(([value, optionLabel]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = optionLabel;
      control.append(option);
    });
  } else {
    control.type = question.type;
    if (question.min !== undefined) control.min = String(question.min);
    if (question.max !== undefined) control.max = String(question.max);
    if (question.step !== undefined) control.step = String(question.step);
  }
  label.append(text, control);
  if (question.help) {
    const help = document.createElement("small");
    help.textContent = question.help;
    label.append(help);
  }
  return label;
}

function generate(elements, calls, state) {
  try {
    const call = calls.find((item) => item.id === elements.call.value);
    const input = {
      projectTitle: elements.projectTitle.value,
      role: elements.role.value,
      externalDeadline: elements.externalDeadline.value,
      internalDeadline: elements.internalDeadline.value
    };
    const answers = Object.fromEntries([...elements.questions.querySelectorAll("[data-answer-id]")].map((control) => [control.dataset.answerId, control.value]));
    const eligibility = evaluateEligibility(call, answers, input.externalDeadline);
    const plan = buildApplicationPlan(call, input, eligibility);
    state.call = call;
    state.eligibility = eligibility;
    state.plan = plan;
    renderOutput(elements, eligibility, plan);
  } catch (error) {
    state.eligibility = null;
    state.plan = null;
    elements.output.hidden = false;
    elements.resultBadge.dataset.status = "block";
    elements.resultBadge.textContent = "Revisa el formulario";
    elements.resultSummary.textContent = error instanceof Error ? error.message : "No se pudo generar el plan.";
    elements.resultChecks.replaceChildren();
    elements.timelineBody.replaceChildren();
    elements.checklist.replaceChildren();
    elements.risks.replaceChildren();
    elements.downloadMarkdown.disabled = true;
    elements.downloadIcs.disabled = true;
  }
}

function renderOutput(elements, eligibility, plan) {
  elements.output.hidden = false;
  elements.resultBadge.dataset.status = eligibility.status;
  elements.resultBadge.textContent = eligibility.label;
  const unresolved = eligibility.checks.filter((item) => item.status !== "pass").length;
  elements.resultSummary.textContent = eligibility.status === "pass"
    ? "El comprobador no ha detectado bloqueos. Conserva las evidencias y solicita la validación institucional."
    : `${unresolved} ${unresolved === 1 ? "regla requiere" : "reglas requieren"} atención antes de comprometer la candidatura.`;
  elements.resultChecks.replaceChildren(...eligibility.checks.map(createCheck));
  elements.timelineBody.replaceChildren(...plan.milestones.map(createMilestoneRow));
  elements.checklist.replaceChildren(...plan.checklist.map(createChecklistGroup));
  elements.risks.replaceChildren(...plan.risks.map(createListItem));
  const source = eligibility.rulePackage.source || plan.source;
  elements.source.href = source.url;
  elements.source.textContent = `${source.label} · ${eligibility.rulePackage.editionReference}`;
  elements.downloadMarkdown.disabled = false;
  elements.downloadIcs.disabled = false;
  elements.openBudget.disabled = !BUDGET_PRESETS[plan.callId];
  elements.output.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createCheck(item) {
  const listItem = document.createElement("li");
  listItem.className = "funding-check";
  listItem.dataset.status = item.status;
  const marker = document.createElement("span");
  marker.className = "funding-check__marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = { pass: "✓", review: "?", block: "×" }[item.status];
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = item.label;
  const detail = document.createElement("p");
  detail.textContent = item.detail;
  copy.append(title, detail);
  listItem.append(marker, copy);
  return listItem;
}

function createMilestoneRow(item) {
  const row = document.createElement("tr");
  row.dataset.state = item.state;
  row.append(tableCell(formatIsoDate(item.isoDate)), tableCell(item.title), tableCell(item.owner), tableCell({ past: "Pasada", today: "Hoy", upcoming: "Pendiente" }[item.state]));
  return row;
}

function tableCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  return cell;
}

function createChecklistGroup(group, groupIndex) {
  const section = document.createElement("section");
  section.className = "funding-checklist-group";
  const title = document.createElement("h5");
  title.textContent = group.title;
  const list = document.createElement("ul");
  group.items.forEach((item, itemIndex) => {
    const row = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `funding-task-${groupIndex}-${itemIndex}`;
    const copy = document.createElement("span");
    const task = document.createElement("strong");
    task.textContent = item.task;
    const owner = document.createElement("small");
    owner.textContent = item.owner;
    copy.append(task, owner);
    label.append(checkbox, copy);
    row.append(label);
    list.append(row);
  });
  section.append(title, list);
  return section;
}

function createListItem(value) {
  const item = document.createElement("li");
  item.textContent = value;
  return item;
}

function resetOutput(elements) {
  elements.output.hidden = true;
  elements.downloadMarkdown.disabled = true;
  elements.downloadIcs.disabled = true;
}

function downloadPlan(type, state) {
  if (!state.plan || !state.eligibility) return;
  const isMarkdown = type === "markdown";
  const content = isMarkdown ? buildPlanMarkdown(state.plan, state.eligibility) : buildPlanIcs(state.plan);
  const blob = new Blob([content], { type: isMarkdown ? "text/markdown;charset=utf-8" : "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.plan.projectTitle)}.${isMarkdown ? "md" : "ics"}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyBudgetPreset(elements, state, budgetHref) {
  const call = state.call;
  const preset = call ? BUDGET_PRESETS[call.id] : null;
  if (!preset) return;
  const detail = { ...preset, projectTitle: elements.projectTitle.value.trim() || `Candidatura ${call.shortName}` };
  if (budgetHref) {
    try { sessionStorage.setItem("funding:budget-preset", JSON.stringify(detail)); } catch { /* La navegación sigue disponible sin preajuste. */ }
    window.location.href = budgetHref;
    return;
  }
  window.dispatchEvent(new CustomEvent("funding:budget-preset", { detail }));
  window.location.hash = "calculadora-presupuesto";
}

function slugify(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "plan-candidatura";
}
