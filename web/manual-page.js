import "./site-shell.js";
import manualData from "./data/manual.json";
import { CATEGORIES } from "./chapter-categories.js";

document.documentElement.style.scrollBehavior = "auto";

const chapters = parseManual(manualData.markdown);
const state = { query: "", category: "all" };
const elements = {
  index: document.querySelector("#manualIndex"),
  content: document.querySelector("#manualChapters"),
  query: document.querySelector("#manualQuery"),
  category: document.querySelector("#manualCategory"),
  status: document.querySelector("#manualStatus"),
  current: document.querySelector("#manualCurrent")
};

renderCategoryOptions();
renderIndex();
renderChapters();
bindFilters();
setupScrollSpy();
focusHash();

function parseManual(markdown) {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim();
  const matches = [...normalized.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? normalized.length;
    const number = Number(match[1]);
    const category = CATEGORIES.find((item) => item.sections.includes(number));
    return { number, title: match[2].trim(), slug: slugify(match[2]), body: normalized.slice(start, end).trim(), category };
  });
}

function renderCategoryOptions() {
  elements.category.append(new Option("Todos los ámbitos", "all"));
  CATEGORIES.forEach((category) => elements.category.append(new Option(category.shortLabel, category.id)));
}

function renderIndex() {
  elements.index.replaceChildren(...CATEGORIES.map((category) => {
    const group = document.createElement("div");
    group.className = "manual-index-group";
    group.dataset.category = category.id;
    const heading = document.createElement("strong");
    heading.textContent = category.shortLabel;
    const list = document.createElement("ol");
    chapters.filter((chapter) => chapter.category?.id === category.id).forEach((chapter) => {
      const item = document.createElement("li");
      item.dataset.chapter = String(chapter.number);
      item.innerHTML = `<a href="#${chapter.slug}" data-manual-link="${chapter.number}"><span>${chapter.number}</span>${escapeHtml(chapter.title)}</a>`;
      list.append(item);
    });
    group.append(heading, list);
    return group;
  }));
}

function renderChapters() {
  elements.content.replaceChildren(...chapters.map((chapter) => {
    const article = document.createElement("article");
    article.className = "manual-chapter";
    article.id = chapter.slug;
    article.dataset.chapter = String(chapter.number);
    article.dataset.category = chapter.category?.id ?? "";
    article.dataset.search = normalize(`${chapter.title} ${stripMarkdown(chapter.body)}`);
    article.innerHTML = `<header><span>Capítulo ${chapter.number}</span><h2>${escapeHtml(chapter.title)}</h2><a href="../example.html?capitulo=${chapter.number}">Abrir ejemplo detallado</a></header>${renderMarkdown(chapter.body, chapter.number)}`;
    return article;
  }));
}

function bindFilters() {
  const update = () => {
    state.query = normalize(elements.query.value);
    state.category = elements.category.value;
    let visible = 0;
    document.querySelectorAll(".manual-chapter").forEach((article) => {
      const matchesCategory = state.category === "all" || article.dataset.category === state.category;
      const matchesQuery = !state.query || state.query.split(/\s+/).every((term) => article.dataset.search.includes(term));
      article.hidden = !(matchesCategory && matchesQuery);
      if (!article.hidden) visible += 1;
    });
    document.querySelectorAll(".manual-index-group").forEach((group) => {
      group.querySelectorAll("li").forEach((item) => { item.hidden = document.querySelector(`.manual-chapter[data-chapter="${item.dataset.chapter}"]`)?.hidden ?? true; });
      group.hidden = [...group.querySelectorAll("li")].every((item) => item.hidden);
    });
    elements.status.textContent = `${visible} ${visible === 1 ? "capítulo visible" : "capítulos visibles"} de ${chapters.length}.`;
  };
  elements.query.addEventListener("input", update);
  elements.category.addEventListener("change", update);
  update();
}

function setupScrollSpy() {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
    if (!visible) return;
    selectChapter(Number(visible.target.dataset.chapter));
  }, { rootMargin: "-20% 0px -70% 0px", threshold: 0 });
  document.querySelectorAll(".manual-chapter").forEach((chapter) => observer.observe(chapter));
}

function selectChapter(number) {
  const chapter = chapters.find((item) => item.number === number);
  if (!chapter) return;
  elements.current.textContent = `${number}. ${chapter.title}`;
  document.querySelectorAll("[data-manual-link]").forEach((link) => {
    const active = Number(link.dataset.manualLink) === number;
    link.toggleAttribute("aria-current", active);
  });
}

function focusHash() {
  if (!window.location.hash) { selectChapter(chapters[0].number); return; }
  requestAnimationFrame(() => {
    const target = document.querySelector(window.location.hash);
    target?.scrollIntoView({ block: "start" });
    if (target?.dataset.chapter) selectChapter(Number(target.dataset.chapter));
  });
}

function renderMarkdown(markdown, chapterNumber) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const heading = line.match(/^(#{3,4})\s+(.+)$/);
    if (heading) { html.push(`<h${heading[1].length}>${renderInline(heading[2])}</h${heading[1].length}>`); index += 1; continue; }
    if (line.startsWith("|")) { const table = []; while (index < lines.length && lines[index].startsWith("|")) table.push(lines[index++]); html.push(renderTable(table)); continue; }
    if (/^[-*]\s+/.test(line)) { const items = []; while (index < lines.length && /^[-*]\s+/.test(lines[index])) items.push(lines[index++].replace(/^[-*]\s+/, "")); html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`); continue; }
    if (/^\d+\.\s+/.test(line)) { const items = []; while (index < lines.length && /^\d+\.\s+/.test(lines[index])) items.push(lines[index++].replace(/^\d+\.\s+/, "")); html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`); continue; }
    if (/^>\s?/.test(line)) { const quote = []; while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, "")); const text = quote.join(" "); const example = /^\*\*Ejemplo realista\b/.test(text); html.push(`<blockquote${example ? ' class="case-example"' : ""}>${renderInline(text)}${example ? `<a class="case-example__open" href="../example.html?capitulo=${chapterNumber}">Abrir guía detallada paso a paso</a>` : ""}</blockquote>`); continue; }
    if (/^---+$/.test(line.trim())) { html.push("<hr>"); index += 1; continue; }
    const paragraph = [line.trim()]; index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) paragraph.push(lines[index++].trim());
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }
  return html.join("");
}

function renderTable(lines) {
  const rows = lines.map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
  if (rows.length < 2 || !rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) return `<p>${renderInline(lines.join(" "))}</p>`;
  const headers = rows[0];
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="Tabla desplazable"><table><thead><tr>${headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.slice(2).map((row) => `<tr>${headers.map((_, column) => `<td>${renderInline(row[column] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderInline(source) {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let output = "", cursor = 0;
  for (const match of source.matchAll(pattern)) {
    output += escapeHtml(source.slice(cursor, match.index));
    if (match[2] !== undefined) { const href = normalizeHref(match[3]); const external = /^https?:\/\//i.test(href); output += `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(match[2])}</a>`; }
    else if (match[4] !== undefined) output += `<code>${escapeHtml(match[4])}</code>`;
    else if (match[5] !== undefined) output += `<strong>${escapeHtml(match[5])}</strong>`;
    else output += `<em>${escapeHtml(match[6])}</em>`;
    cursor = match.index + match[0].length;
  }
  return output + escapeHtml(source.slice(cursor));
}

function normalizeHref(href) {
  const value = href.trim();
  if (/^(https?:|mailto:|#)/i.test(value)) return value;
  if (/^(javascript:|data:|vbscript:)/i.test(value)) return "#";
  return `../${value.replace(/^\.\//, "")}`;
}
function isBlockStart(line) { return /^(#{3,4})\s+|^\||^[-*]\s+|^\d+\.\s+|^>\s?|^---+$/.test(line); }
function stripMarkdown(value) { return value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_>#|:-]/g, " ").replace(/\s+/g, " "); }
function slugify(value) { return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function normalize(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
