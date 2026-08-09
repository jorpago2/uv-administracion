const STOP_WORDS = new Set([
  "a", "al", "como", "con", "cual", "de", "del", "donde", "el", "en", "la", "las", "los", "o", "para", "por", "que", "un", "una", "y"
]);

const QUERY_ALIASES = Object.freeze({
  beca: ["ayuda", "financiacion"],
  baja: ["permiso", "licencia", "incapacidad"],
  nomina: ["salario", "retribucion"],
  patente: ["invencion", "protegible", "propiedad industrial"],
  profesor: ["pdi", "docente"],
  sueldo: ["salario", "retribucion"]
});

export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeSearchQuery(query) {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  const usefulWords = words.filter((word) => !STOP_WORDS.has(word));
  return [...new Set(usefulWords.length ? usefulWords : words)];
}

export function prepareSearchEntry(entry) {
  const title = String(entry.title ?? "");
  const category = String(entry.category ?? "");
  const keywords = String(entry.keywords ?? "");
  const content = String(entry.content ?? "");
  return {
    ...entry,
    title,
    category,
    keywords,
    content,
    normalizedTitle: normalizeSearchText(title),
    normalizedKeywords: normalizeSearchText(`${category} ${keywords}`),
    normalizedContent: normalizeSearchText(content)
  };
}

export function matchesSearchQuery(entry, query) {
  const terms = tokenizeSearchQuery(query);
  if (!terms.length) return true;
  const prepared = entry.normalizedTitle === undefined ? prepareSearchEntry(entry) : entry;
  return terms.every((term) => matchesTerm(prepared, term));
}

export function rankSearchEntries(entries, query, limit = 8) {
  const normalizedQuery = normalizeSearchText(query);
  const terms = tokenizeSearchQuery(query);
  if (!normalizedQuery || !terms.length || limit <= 0) return [];

  return entries
    .map((entry, order) => {
      const prepared = entry.normalizedTitle === undefined ? prepareSearchEntry(entry) : entry;
      if (!terms.every((term) => matchesTerm(prepared, term))) return null;
      return { ...prepared, score: scoreEntry(prepared, normalizedQuery, terms), order };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, limit);
}

export function createSearchSnippet(content, query, maximumLength = 180) {
  const plain = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!plain || maximumLength < 20) return plain;
  const normalized = normalizeSearchText(plain);
  const positions = tokenizeSearchQuery(query)
    .flatMap(termAlternatives)
    .map((term) => normalized.indexOf(normalizeSearchText(term)))
    .filter((position) => position >= 0);
  const matchPosition = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, matchPosition - Math.floor(maximumLength * 0.35));
  let end = Math.min(plain.length, start + maximumLength);

  if (start > 0) {
    const nextSpace = plain.indexOf(" ", start);
    start = nextSpace >= 0 && nextSpace < end ? nextSpace + 1 : start;
  }
  if (end < plain.length) {
    const previousSpace = plain.lastIndexOf(" ", end);
    end = previousSpace > start ? previousSpace : end;
  }
  return `${start > 0 ? "…" : ""}${plain.slice(start, end).trim()}${end < plain.length ? "…" : ""}`;
}

function matchesTerm(entry, term) {
  const alternatives = termAlternatives(term);
  return alternatives.some((alternative) => {
    if (entry.normalizedTitle.includes(alternative)
      || entry.normalizedKeywords.includes(alternative)
      || entry.normalizedContent.includes(alternative)) return true;
    if (alternative.length < 5 || alternative.includes(" ")) return false;
    return searchableWords(entry).some((word) => {
      const forms = word.endsWith("s") && word.length > 4 ? [word, word.slice(0, -1)] : [word];
      return forms.some((form) => Math.abs(form.length - alternative.length) <= 1 && editDistanceAtMostOne(form, alternative));
    });
  });
}

function scoreEntry(entry, normalizedQuery, terms) {
  let score = Number(entry.priority ?? 0);
  if (entry.normalizedTitle === normalizedQuery) score += 220;
  else if (entry.normalizedTitle.startsWith(normalizedQuery)) score += 150;
  else if (entry.normalizedTitle.includes(normalizedQuery)) score += 110;

  terms.forEach((term) => {
    const alternatives = termAlternatives(term);
    const best = Math.max(...alternatives.map((alternative) => {
      if (wordSet(entry.normalizedTitle).has(alternative)) return 55;
      if (entry.normalizedTitle.includes(alternative)) return 42;
      if (alternative.length >= 5 && fuzzyWordMatch(entry.normalizedTitle, alternative)) return 32;
      if (entry.normalizedKeywords.includes(alternative)) return 24;
      if (entry.normalizedContent.includes(alternative)) return 8;
      return 3;
    }));
    score += best;
  });
  return score;
}

function termAlternatives(term) {
  const normalized = normalizeSearchText(term);
  const bases = normalized.endsWith("s") && normalized.length > 4
    ? [normalized, normalized.slice(0, -1)]
    : [normalized];
  return [...new Set(bases.flatMap((base) => [base, ...(QUERY_ALIASES[base] ?? [])]).map(normalizeSearchText))];
}

function searchableWords(entry) {
  if (!entry._searchableWords) {
    Object.defineProperty(entry, "_searchableWords", {
      configurable: true,
      value: [...wordSet(`${entry.normalizedTitle} ${entry.normalizedKeywords} ${entry.normalizedContent}`)]
    });
  }
  return entry._searchableWords;
}

function wordSet(value) {
  return new Set(String(value).split(" ").filter(Boolean));
}

function fuzzyWordMatch(value, term) {
  return [...wordSet(value)].some((word) => {
    const forms = word.endsWith("s") && word.length > 4 ? [word, word.slice(0, -1)] : [word];
    return forms.some((form) => Math.abs(form.length - term.length) <= 1 && editDistanceAtMostOne(form, term));
  });
}

function editDistanceAtMostOne(left, right) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const mismatch = [...left].findIndex((character, index) => character !== right[index]);
    if (mismatch >= 0
      && mismatch + 1 < left.length
      && left[mismatch] === right[mismatch + 1]
      && left[mismatch + 1] === right[mismatch]
      && left.slice(mismatch + 2) === right.slice(mismatch + 2)) return true;
  }
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return true;
}
