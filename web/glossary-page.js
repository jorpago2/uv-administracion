import "./site-shell.js";
import { initGlossary } from "./glossary.js";

const root = document.querySelector("#glosario");
initGlossary(root);
const query = new URLSearchParams(window.location.search).get("q");
if (query) {
  const input = root.querySelector("#glossaryQuery");
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

