const REQUIRED_GUIDE_FIELDS = Object.freeze([
  "outcome", "firstMove", "unit", "channel", "deadline", "alsoApplies", "adapt", "stopsApplying", "doNotAssume"
]);
const ACADEMIC_PROGRAMME_IDS = new Set(["giet", "giei", "git", "muie", "die-doctorado"]);

export function buildSituationGuides(catalog, baseGuides, academicContextCatalog = null) {
  validateCatalog(catalog);
  if (!Array.isArray(baseGuides)) throw new TypeError("Las guías base no tienen el formato esperado.");
  const academicContexts = validateAcademicContextCatalog(academicContextCatalog, catalog);
  const baseByChapter = new Map(baseGuides.map((guide) => [guide.chapterNumber, guide]));
  const categories = new Map(catalog.categories.map((category) => [category.id, category.label]));
  const guides = catalog.situations.map((situation) => {
    const base = situation.baseChapter ? baseByChapter.get(situation.baseChapter) : null;
    if (situation.baseChapter && !base) throw new Error(`No existe la guía base del capítulo ${situation.baseChapter} para ${situation.id}.`);
    const profile = situation.profile ? catalog.profiles?.[situation.profile] : null;
    if (situation.profile && !profile) throw new Error(`No existe el perfil ${situation.profile} para ${situation.id}.`);
    // Los perfiles ampliados ya aportan el contrato operativo completo. Heredar
    // además las listas del ejemplo general del capítulo mezclaría rutas distintas.
    const inheritedLists = profile ? null : base;
    const overrides = situation.guide ?? {};
    const guide = {
      ...(base ?? {}),
      ...(profile ?? {}),
      ...overrides,
      id: situation.id,
      situationNumber: situation.number,
      categoryId: situation.category,
      categoryLabel: categories.get(situation.category),
      title: situation.title,
      scenario: situation.scenario,
      aliases: [...situation.aliases],
      chapterNumber: situation.baseChapter ?? overrides.chapterNumber,
      chapterTitle: base?.chapterTitle ?? overrides.chapterTitle ?? "Orientación y administración",
      chapterSlug: base?.chapterSlug ?? overrides.chapterSlug ?? "como-utilizar-este-manual",
      questions: merge(overrides.questions, profile?.questions, inheritedLists?.questions),
      successChecks: merge(overrides.successChecks, profile?.successChecks, inheritedLists?.successChecks, situation.resolution.completionEvidence),
      responsibilities: mergeObjects(overrides.responsibilities, profile?.responsibilities, inheritedLists?.responsibilities),
      documents: merge(overrides.documents, profile?.documents, inheritedLists?.documents),
      steps: mergeSteps(overrides.steps, profile?.steps, inheritedLists?.steps),
      risks: merge(overrides.risks, profile?.risks, inheritedLists?.risks, profile ? [] : situation.resolution.stopConditions),
      sources: mergeSources(overrides.sources, profile?.sources, inheritedLists?.sources),
      procedureTitles: merge(overrides.procedureTitles, profile?.procedureTitles, inheritedLists?.procedureTitles),
      decisionRules: [...situation.resolution.decisionRules],
      stopConditions: [...situation.resolution.stopConditions],
      completionEvidence: [...situation.resolution.completionEvidence],
      escalation: [...situation.resolution.escalation],
      relatedTools: [...(situation.relatedTools ?? [])],
      reviewedOn: situation.reviewedOn,
      academicContext: cloneAcademicContext(academicContexts.get(situation.id))
    };
    validateResolvedGuide(guide);
    return Object.freeze(guide);
  });
  return Object.freeze(guides);
}

export function searchSituationGuides(guides, query = "", category = "all") {
  if (!Array.isArray(guides)) throw new TypeError("Las situaciones no tienen el formato esperado.");
  const terms = tokenize(query);
  return guides
    .filter((guide) => category === "all" || guide.categoryId === category)
    .map((guide) => ({ guide, score: scoreGuide(guide, terms) }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((left, right) => right.score - left.score || left.guide.situationNumber - right.guide.situationNumber)
    .map(({ guide }) => guide);
}

export function combineSituationCatalogs(...catalogs) {
  if (!catalogs.length) throw new TypeError("Falta al menos un catálogo de situaciones.");
  const [first, ...rest] = catalogs;
  if (first?.schemaVersion !== 1 || !Array.isArray(first.categories) || !Array.isArray(first.situations)) {
    throw new TypeError("El primer catálogo de situaciones no tiene el formato esperado.");
  }
  const categorySignature = JSON.stringify(first.categories);
  rest.forEach((catalog) => {
    if (catalog?.schemaVersion !== 1 || JSON.stringify(catalog.categories) !== categorySignature || !Array.isArray(catalog.situations)) {
      throw new TypeError("Los catálogos de situaciones no son compatibles.");
    }
  });
  return Object.freeze({
    schemaVersion: 1,
    meta: { ...first.meta, ...(rest.at(-1)?.meta ?? {}) },
    categories: first.categories.map((category) => ({ ...category })),
    profiles: Object.assign({}, ...catalogs.map((catalog) => catalog.profiles ?? {})),
    situations: catalogs.flatMap((catalog) => catalog.situations)
  });
}

export function findSituationGuide(guides, id) {
  return guides.find((guide) => guide.id === id) ?? null;
}

export function situationSearchItems(guides) {
  return guides.map((guide) => ({
    id: guide.id,
    title: guide.title,
    category: guide.categoryLabel,
    content: [
      guide.scenario, guide.outcome, guide.firstMove, ...guide.aliases, ...guide.questions, ...guide.decisionRules,
      ...academicSearchContent(guide.academicContext)
    ].join(" "),
    href: `example.html?caso=${encodeURIComponent(guide.id)}`
  }));
}

function validateAcademicContextCatalog(contextCatalog, situationCatalog) {
  if (contextCatalog === null || contextCatalog === undefined) return new Map();
  if (contextCatalog.schemaVersion !== 1 || !Array.isArray(contextCatalog.contexts)) {
    throw new TypeError("El catálogo de contexto académico no tiene el formato esperado.");
  }
  const situationIds = new Set(situationCatalog.situations.map((situation) => situation.id));
  const contexts = new Map();
  contextCatalog.contexts.forEach((context) => {
    if (!situationIds.has(context.situationId) || contexts.has(context.situationId)) {
      throw new Error(`Contexto académico desconocido o duplicado: ${context.situationId ?? "vacío"}.`);
    }
    if (!Array.isArray(context.programmeIds) || !context.programmeIds.length || context.programmeIds.some((id) => !ACADEMIC_PROGRAMME_IDS.has(id))) {
      throw new Error(`Programas académicos inválidos en ${context.situationId}.`);
    }
    if (!Array.isArray(context.documentTypes) || !context.documentTypes.length || context.documentTypes.some((type) => !["ficha", "verifica", "plan", "seguimiento"].includes(type))) {
      throw new Error(`Familias documentales inválidas en ${context.situationId}.`);
    }
    for (const field of ["authority", "example", "approvalGate"]) {
      if (typeof context[field] !== "string" || context[field].trim().length < 40) throw new Error(`Falta ${field} en ${context.situationId}.`);
    }
    if (!Array.isArray(context.differences) || context.differences.length < 2) throw new Error(`Faltan diferencias académicas en ${context.situationId}.`);
    const notes = context.programmeNotes ?? {};
    if (Object.keys(notes).some((id) => !context.programmeIds.includes(id) || typeof notes[id] !== "string")) {
      throw new Error(`Notas de programa inválidas en ${context.situationId}.`);
    }
    contexts.set(context.situationId, context);
  });
  return contexts;
}

function cloneAcademicContext(context) {
  if (!context) return null;
  return Object.freeze({
    programmeIds: Object.freeze([...context.programmeIds]),
    authority: context.authority,
    documentTypes: Object.freeze([...context.documentTypes]),
    programmeNotes: Object.freeze({ ...(context.programmeNotes ?? {}) }),
    differences: Object.freeze([...context.differences]),
    example: context.example,
    approvalGate: context.approvalGate
  });
}

function academicSearchContent(context) {
  if (!context) return [];
  return [
    ...context.programmeIds,
    context.authority,
    ...context.documentTypes,
    ...Object.values(context.programmeNotes),
    ...context.differences,
    context.example,
    context.approvalGate
  ];
}

function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.categories) || !Array.isArray(catalog.situations)) {
    throw new TypeError("El catálogo de situaciones no tiene el formato esperado.");
  }
  const categoryIds = new Set(catalog.categories.map((category) => category.id));
  const ids = new Set();
  const numbers = new Set();
  catalog.situations.forEach((situation) => {
    if (!situation.id || ids.has(situation.id)) throw new Error(`Identificador de situación inválido o duplicado: ${situation.id ?? "vacío"}.`);
    if (!Number.isInteger(situation.number) || numbers.has(situation.number)) throw new Error(`Número de situación inválido o duplicado: ${situation.number}.`);
    ids.add(situation.id);
    numbers.add(situation.number);
    if (!categoryIds.has(situation.category) || !situation.title || !situation.scenario || !Array.isArray(situation.aliases)) {
      throw new Error(`Situación incompleta: ${situation.id}.`);
    }
    if (situation.profile && typeof situation.profile !== "string") throw new Error(`Perfil inválido en ${situation.id}.`);
    for (const field of ["decisionRules", "stopConditions", "completionEvidence", "escalation"]) {
      if (!Array.isArray(situation.resolution?.[field]) || situation.resolution[field].length < 2) {
        throw new Error(`La situación ${situation.id} no define al menos dos elementos en ${field}.`);
      }
    }
  });
  const expected = Array.from({ length: catalog.situations.length }, (_, index) => index + 1);
  if (expected.some((number) => !numbers.has(number))) throw new Error("La numeración de situaciones no es consecutiva desde 1.");
}

function validateResolvedGuide(guide) {
  REQUIRED_GUIDE_FIELDS.forEach((field) => {
    const minimum = ["unit", "channel", "deadline"].includes(field) ? 8 : 20;
    if (typeof guide[field] !== "string" || guide[field].trim().length < minimum) throw new Error(`La situación ${guide.id} no resuelve el campo ${field}.`);
  });
  const arrayRequirements = { questions: 3, successChecks: 3, responsibilities: 2, documents: 4, steps: 3, risks: 3, sources: 1 };
  Object.entries(arrayRequirements).forEach(([field, minimum]) => {
    if (!Array.isArray(guide[field]) || guide[field].length < minimum) throw new Error(`La situación ${guide.id} necesita al menos ${minimum} elementos en ${field}.`);
  });
  guide.sources.forEach((source) => {
    if (!source.label || !/^https:\/\//.test(source.url)) throw new Error(`Fuente no oficializable en ${guide.id}.`);
  });
}

function merge(...arrays) {
  return [...new Set(arrays.flatMap((array) => Array.isArray(array) ? array : []).map((value) => String(value).trim()).filter(Boolean))];
}

function mergeObjects(...arrays) {
  const result = [];
  const seen = new Set();
  arrays.flatMap((array) => Array.isArray(array) ? array : []).forEach((item) => {
    const key = `${item.actor}|${item.task}`;
    if (!seen.has(key) && item.actor && item.task) { seen.add(key); result.push({ ...item }); }
  });
  return result;
}

function mergeSteps(...arrays) {
  const result = [];
  const seen = new Set();
  arrays.flatMap((array) => Array.isArray(array) ? array : []).forEach((step) => {
    const key = typeof step === "string" ? step : step.action;
    if (key && !seen.has(key)) { seen.add(key); result.push(typeof step === "string" ? step : { ...step }); }
  });
  return result;
}

function mergeSources(...arrays) {
  const result = [];
  const seen = new Set();
  arrays.flatMap((array) => Array.isArray(array) ? array : []).forEach((source) => {
    const key = source.url?.replace(/\/$/, "");
    if (key && !seen.has(key)) { seen.add(key); result.push({ ...source }); }
  });
  return result;
}

function scoreGuide(guide, terms) {
  if (!terms.length) return 0;
  const title = normalize(guide.title);
  const aliases = normalize(guide.aliases.join(" "));
  const body = normalize([
    guide.scenario, guide.outcome, guide.firstMove, ...guide.questions, ...guide.decisionRules,
    ...academicSearchContent(guide.academicContext)
  ].join(" "));
  return terms.reduce((score, term) => score + (title.includes(term) ? 12 : 0) + (aliases.includes(term) ? 8 : 0) + (body.includes(term) ? 3 : 0), 0);
}

function tokenize(value) {
  return normalize(value).split(/\s+/).filter((term) => term.length >= 2);
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").replace(/\s+/g, " ").trim();
}
