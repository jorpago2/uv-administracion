import "./site-shell.js";

const form = document.querySelector("#hubSearchForm");
if (form) initHubSearch(form);

async function initHubSearch(searchForm) {
  const input = searchForm.querySelector("#hubSearch");
  const status = document.querySelector("#hubSearchStatus");
  const results = document.querySelector("#hubSearchResults");
  let entries = [];
  let timer = 0;

  try {
    const response = await fetch(new URL("./data/site-search.json", import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    entries = await response.json();
  } catch {
    status.textContent = "No se ha podido cargar el índice. Utiliza Resolver o explora por ámbito.";
  }

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => render(input.value), 180);
  });
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.clearTimeout(timer);
    render(input.value, true);
  });

  function render(rawQuery, focusFirst = false) {
    const terms = tokenize(rawQuery);
    if (!terms.length) {
      results.hidden = true;
      results.replaceChildren();
      status.textContent = "";
      return;
    }
    const matches = entries
      .map((entry) => ({ ...entry, score: scoreEntry(entry, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "es"))
      .slice(0, 8);
    results.replaceChildren(...matches.map(renderResult));
    results.hidden = false;
    status.textContent = matches.length ? `${matches.length === 1 ? "1 resultado prioritario" : `${matches.length} resultados prioritarios`}.` : "No hay coincidencia directa. Prueba con otra acción o abre el resolutor.";
    if (!matches.length) {
      const fallback = document.createElement("a");
      fallback.className = "hub-search-result hub-search-result--empty";
      fallback.href = "resolver/";
      fallback.innerHTML = "<strong>Abrir las 104 situaciones</strong><span>Filtra el catálogo completo por ámbito.</span>";
      results.append(fallback);
    }
    if (focusFirst) results.querySelector("a")?.focus();
  }
}

function renderResult(entry) {
  const link = document.createElement("a");
  link.className = "hub-search-result";
  link.href = entry.href;
  const kind = document.createElement("span");
  kind.className = "hub-search-result__kind";
  kind.textContent = entry.kind;
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const context = document.createElement("small");
  context.textContent = entry.context;
  link.append(kind, title, context);
  return link;
}

function scoreEntry(entry, terms) {
  const title = normalize(entry.title);
  const haystack = normalize(`${entry.title} ${entry.context} ${entry.keywords ?? ""}`);
  if (!terms.every((term) => haystack.includes(term))) return 0;
  return terms.reduce((score, term) => score + (title.startsWith(term) ? 8 : title.includes(term) ? 5 : 2), Number(entry.priority ?? 0));
}

function tokenize(value) {
  return normalize(value).split(/\s+/).filter((term) => term.length > 1);
}

function normalize(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}
