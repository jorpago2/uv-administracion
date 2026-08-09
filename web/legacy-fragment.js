export async function loadLegacySections(sectionIds, target) {
  if (!(target instanceof HTMLElement)) throw new TypeError("Falta el contenedor de contenido.");
  const root = document.body.dataset.root ?? "./";
  const response = await fetch(`${root}consulta.html`);
  if (!response.ok) throw new Error(`No se pudo cargar el contenido base (HTTP ${response.status}).`);
  const source = new DOMParser().parseFromString(await response.text(), "text/html");
  const sections = sectionIds.map((id) => source.getElementById(id));
  const missing = sectionIds.filter((id, index) => !sections[index]);
  if (missing.length) throw new Error(`Faltan secciones: ${missing.join(", ")}.`);
  target.replaceChildren(...sections.map((section) => document.importNode(section, true)));
  target.setAttribute("aria-busy", "false");
  return Object.fromEntries(sectionIds.map((id) => [id, document.getElementById(id)]));
}

export function showSectionLoadError(target, error) {
  target.setAttribute("aria-busy", "false");
  const message = error instanceof Error ? error.message : "No se pudo cargar el contenido.";
  target.innerHTML = `<section class="fragment-error" role="alert"><h2>El contenido no se ha cargado</h2><p>${escapeHtml(message)} Recarga la página o utiliza la vista completa.</p><a href="${document.body.dataset.root ?? "./"}consulta.html">Abrir vista completa</a></section>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

