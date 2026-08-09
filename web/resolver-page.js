import "./site-shell.js";
import { initSituationDirectory } from "./situations.js";

const root = document.querySelector("#situaciones");
const controller = initSituationDirectory(root, { detailBase: "../example.html" });
document.querySelector("#resolverTotal").textContent = String(controller.count);

const query = new URLSearchParams(window.location.search).get("q");
if (query) {
  const input = root.querySelector("#situationQuery");
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

