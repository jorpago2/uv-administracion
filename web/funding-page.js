import "./site-shell.js";
import { initFundingExplorer } from "./funding-explorer.js";
import { initFundingPlanner } from "./funding-planner.js";
import { loadLegacySections, showSectionLoadError } from "./legacy-fragment.js";

const target = document.querySelector("#fundingContent");
try {
  const sections = await loadLegacySections(["explorador-financiacion"], target);
  initFundingExplorer(sections["explorador-financiacion"]);
  initFundingPlanner(sections["explorador-financiacion"], { budgetHref: "../herramientas/#calculadora-presupuesto" });
  const query = new URLSearchParams(window.location.search).get("q");
  if (query) {
    const input = document.querySelector("#fundingQuery");
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  focusHashTarget();
} catch (error) {
  showSectionLoadError(target, error);
}

function focusHashTarget() {
  if (!window.location.hash) return;
  requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView({ block: "start" }));
}

