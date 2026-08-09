const STATUS_ORDER = Object.freeze({ reinforce: 0, generic: 1, low: 2, specific: 3 });

export function buildContentAudit(guides, rawSituations, config) {
  validateInputs(guides, rawSituations, config);
  const rawById = new Map(rawSituations.map((situation) => [situation.id, situation]));
  const reinforceIds = new Set(config.reinforceSituationIds);
  const lowIds = new Set(config.lowRelevanceSituationIds);
  const highPriorityIds = new Set(config.highPrioritySituationIds);
  const statusById = new Map(config.statuses.map((status) => [status.id, status]));

  return Object.freeze(guides.map((guide) => {
    const raw = rawById.get(guide.id);
    const statusId = classifyGuide(guide, raw, reinforceIds, lowIds);
    const status = statusById.get(statusId);
    const metrics = Object.freeze({
      sources: guide.sources.length,
      steps: guide.steps.length,
      documents: guide.documents.length,
      completionEvidence: guide.completionEvidence.length
    });
    return Object.freeze({
      id: guide.id,
      number: guide.situationNumber,
      title: guide.title,
      scenario: guide.scenario,
      categoryId: guide.categoryId,
      categoryLabel: guide.categoryLabel,
      statusId,
      statusLabel: status.label,
      priority: highPriorityIds.has(guide.id) ? "alta" : statusId === "reinforce" ? "media" : "normal",
      rationale: explainClassification(guide, raw, statusId),
      nextAction: nextAction(statusId),
      contextualized: Boolean(guide.academicContext || guide.personalResearchContext),
      metrics
    });
  }));
}

export function summarizeContentAudit(assessments, config) {
  if (!Array.isArray(assessments)) throw new TypeError("La auditoría no tiene el formato esperado.");
  const counts = Object.fromEntries(config.statuses.map((status) => [status.id, 0]));
  assessments.forEach((assessment) => { counts[assessment.statusId] += 1; });
  return Object.freeze({
    total: assessments.length,
    counts: Object.freeze(counts),
    highPriority: assessments.filter((assessment) => assessment.priority === "alta").length,
    missing: config.missingCases.length,
    weakSourceSupport: assessments.filter((assessment) => assessment.metrics.sources === 1).length,
    shortRoutes: assessments.filter((assessment) => assessment.metrics.steps < 4).length
  });
}

export function filterContentAudit(assessments, { query = "", status = "all", category = "all", priority = "all" } = {}) {
  const terms = tokenize(query);
  return assessments
    .filter((assessment) => status === "all" || assessment.statusId === status)
    .filter((assessment) => category === "all" || assessment.categoryId === category)
    .filter((assessment) => priority === "all" || assessment.priority === priority)
    .filter((assessment) => terms.every((term) => normalize([
      assessment.title, assessment.scenario, assessment.categoryLabel, assessment.statusLabel,
      assessment.rationale, assessment.nextAction
    ].join(" ")).includes(term)))
    .sort((left, right) =>
      priorityRank(left.priority) - priorityRank(right.priority)
      || STATUS_ORDER[left.statusId] - STATUS_ORDER[right.statusId]
      || left.number - right.number
    );
}

function classifyGuide(guide, raw, reinforceIds, lowIds) {
  if (reinforceIds.has(guide.id)) return "reinforce";
  if (lowIds.has(guide.id)) return "low";
  if (guide.academicContext || ["direct", "support"].includes(guide.personalResearchContext?.fit) || raw.profile) return "specific";
  return "generic";
}

function explainClassification(guide, raw, statusId) {
  if (statusId === "reinforce") {
    return `La ruta contiene ${guide.steps.length} pasos, pero se apoya en una sola fuente enlazada; falta contrastar el canal o la instrucción específica antes de considerarla cerrada.`;
  }
  if (statusId === "low") {
    return "Su aplicación depende de trabajar con personas, muestras humanas, animales, OMG o datos sujetos a consentimiento, condiciones no declaradas en el perfil investigador actual.";
  }
  if (statusId === "generic") {
    return `Es útil para el empleo o la administración UV, pero todavía no tiene una capa específica de ETSE/DIE o ICMUV/UMDO+. Reúne ${guide.sources.length} fuentes y ${guide.steps.length} pasos.`;
  }
  const contexts = [
    guide.academicContext ? "ETSE/DIE y titulaciones" : "",
    guide.personalResearchContext ? "ciclo investigador ICMUV" : "",
    raw.profile ? "perfil operativo específico" : ""
  ].filter(Boolean).join(", ");
  return `Está contextualizado mediante ${contexts}; reúne ${guide.sources.length} fuentes, ${guide.steps.length} pasos y ${guide.completionEvidence.length} evidencias de cierre.`;
}

function nextAction(statusId) {
  if (statusId === "reinforce") return "Añadir una segunda fuente oficial y confirmar unidad, canal, documentos y momento de autorización.";
  if (statusId === "generic") return "Sustituir la ruta genérica por el contacto inicial, el ejemplo y el límite de competencia aplicables a Jorge.";
  if (statusId === "low") return "Mantener como ruta condicional y revisarla solo si cambia la actividad o aparecen las condiciones indicadas.";
  return "Mantener; revisar vigencia de fuentes y procedimiento cuando cambie la normativa o la unidad responsable.";
}

function validateInputs(guides, rawSituations, config) {
  if (!Array.isArray(guides) || !Array.isArray(rawSituations) || config?.schemaVersion !== 1) {
    throw new TypeError("No se puede construir la auditoría con los datos recibidos.");
  }
  const guideIds = new Set(guides.map((guide) => guide.id));
  const rawIds = new Set(rawSituations.map((situation) => situation.id));
  if (guideIds.size !== guides.length || rawIds.size !== rawSituations.length || guides.some((guide) => !rawIds.has(guide.id))) {
    throw new Error("El catálogo y las guías de la auditoría no coinciden.");
  }
  const configuredIds = [
    ...config.reinforceSituationIds,
    ...config.lowRelevanceSituationIds,
    ...config.highPrioritySituationIds
  ];
  const unknownId = configuredIds.find((id) => !guideIds.has(id));
  if (unknownId) throw new Error(`La auditoría referencia una situación desconocida: ${unknownId}.`);
  const statusIds = new Set(config.statuses.map((status) => status.id));
  if (!["specific", "generic", "reinforce", "low"].every((id) => statusIds.has(id))) {
    throw new Error("Faltan estados obligatorios de auditoría.");
  }
}

function tokenize(value) {
  return normalize(value).split(/\s+/).filter((term) => term.length > 1);
}

function normalize(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function priorityRank(priority) {
  return priority === "alta" ? 0 : priority === "media" ? 1 : 2;
}
