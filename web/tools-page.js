import "./site-shell.js";
import { initDecisionTools } from "./decision-tools.js";
import { initOperationalTools } from "./operational-tools.js";
import { initProjectBudget } from "./project-budget.js";
import { initSalaryCalculator } from "./salary-calculator.js";
import { loadLegacySections, showSectionLoadError } from "./legacy-fragment.js";

const target = document.querySelector("#toolsContent");
try {
  const sections = await loadLegacySections(["herramientas-operativas", "calculadoras-operativas", "calculadora-retributiva"], target);
  initOperationalTools(sections["herramientas-operativas"]);
  initDecisionTools(sections["calculadoras-operativas"]);
  initProjectBudget(document.querySelector("#calculadora-presupuesto"));
  initSalaryCalculator(document.querySelector("#salaryCalculator"));
  focusHashTarget();
} catch (error) {
  showSectionLoadError(target, error);
}

function focusHashTarget() {
  if (!window.location.hash) return;
  requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" }));
}

