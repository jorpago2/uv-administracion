export const MERIT_PROFILE_DEFAULTS = Object.freeze({
  sexennia: 1,
  quinquennia: 1,
  individualTheses: 0,
  coDirectedTheses: 0,
  tfm9: 0,
  stateIpYears: 0,
  stateMemberYears: 0,
  qualifyingStays: 0,
  openManuals: 0,
  tfg6: 0,
  collaborationScholarships: 0,
  erasmusYears: 0,
  teacherTrainingBlocks: 0,
  otherTeamLeadershipPeriods: 0,
  managementPeriods: 0,
  scientificResponsibilityPeriods: 0,
  ipAllocation: "research"
});

export const TRADEOFF_OBJECTIVES = Object.freeze({
  balanced: Object.freeze({ label: "Equilibrio de carrera", weights: { cu: 1, funding: 1, independence: 1, transfer: 0.5, international: 0.6 } }),
  cu: Object.freeze({ label: "Llegar antes a CU", weights: { cu: 2, funding: 0.6, independence: 0.9, transfer: 0.25, international: 0.3 } }),
  funding: Object.freeze({ label: "Consolidar financiación", weights: { cu: 0.6, funding: 2, independence: 1.2, transfer: 0.5, international: 0.8 } }),
  europe: Object.freeze({ label: "Internacionalizar la línea", weights: { cu: 0.4, funding: 1.2, independence: 1.2, transfer: 0.5, international: 3 } }),
  transfer: Object.freeze({ label: "Transferir tecnología", weights: { cu: 0.4, funding: 0.8, independence: 0.8, transfer: 3.5, international: 0.2 } })
});

export function validateMeritMapData(data) {
  if (!data || !Array.isArray(data.systems) || !Array.isArray(data.assets) || !Array.isArray(data.sources)) throw new TypeError("Mapa de méritos incompleto");
  const systemIds = uniqueIds(data.systems, "sistema");
  const sourceIds = uniqueIds(data.sources, "fuente");
  uniqueIds(data.assets, "activo");
  uniqueIds(data.tradeoffOptions ?? [], "ruta de trade-off");
  for (const route of data.tradeoffOptions ?? []) {
    for (const key of ["cu", "funding", "independence", "transfer", "international"]) requireScore(route.benefits?.[key], `${route.id}.benefits.${key}`);
    for (const key of ["time", "uncertainty", "dependency"]) requireScore(route.burdens?.[key], `${route.id}.burdens.${key}`);
    requireScore(route.readiness, `${route.id}.readiness`);
    if (!Array.isArray(route.effortHours) || route.effortHours.length !== 2 || route.effortHours.some((value) => !Number.isFinite(value) || value < 0)) throw new TypeError(`Horas inválidas en ${route.id}`);
  }
  for (const asset of data.assets) {
    for (const systemId of Object.keys(asset.systems ?? {})) {
      if (!systemIds.has(systemId)) throw new Error(`Sistema desconocido en ${asset.id}: ${systemId}`);
    }
  }
  for (const item of [...data.systems, ...(data.callScorecards ?? []), ...(data.tailoredCalls ?? []), ...(data.tradeoffOptions ?? [])]) {
    for (const sourceId of item.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) throw new Error(`Fuente desconocida en ${item.id}: ${sourceId}`);
    }
  }
  return true;
}

export function calculateTradeoffRanking(options, rawSettings = {}) {
  if (!Array.isArray(options)) throw new TypeError("Las rutas de decisión deben ser una lista");
  const objective = TRADEOFF_OBJECTIVES[rawSettings.objective] ? rawSettings.objective : "balanced";
  const capacityHours = integer(rawSettings.capacityHours, 2, 20, 8);
  const objectiveProfile = TRADEOFF_OBJECTIVES[objective];
  const ranked = options.map((option) => scoreTradeoffOption(option, objectiveProfile.weights, capacityHours));
  ranked.sort((left, right) => right.priorityIndex - left.priorityIndex || right.strategicValue - left.strategicValue || left.title.localeCompare(right.title, "es"));
  return {
    objective,
    objectiveLabel: objectiveProfile.label,
    capacityHours,
    routes: ranked,
    primary: ranked[0] ?? null,
    complement: findComplement(ranked),
    overloadCount: ranked.filter((route) => route.capacityState === "overload").length
  };
}

export function calculateMeritScenario(rawProfile = {}) {
  const profile = normalizeProfile(rawProfile);
  const research = calculateResearch(profile);
  const teaching = calculateTeaching(profile);
  const leadership = calculateLeadership(profile);
  return {
    profile,
    blocks: [research, teaching, leadership],
    warnings: [
      "Los subtotales solo incluyen las aportaciones configuradas; no predicen el resultado del bloque ni de la acreditación.",
      "Cada bloque CU necesita 50/100 y sus mínimos obligatorios. Alcanzar un subtotal numérico no sustituye el juicio técnico de la comisión.",
      "Una misma contribución no debe computarse dos veces. El selector de proyecto IP obliga a asignarla a investigación o a liderazgo.",
      "Los pesos de las convocatorias describen cómo se evalúa una propuesta; no convierten automáticamente un mérito del CV en esos puntos."
    ],
    priorities: buildPriorities(profile, research, teaching, leadership)
  };
}

export function filterAssets(assets, { domain = "all", system = "all", query = "" } = {}) {
  const normalizedQuery = normalizeText(query);
  return assets.filter((asset) => {
    if (domain !== "all" && asset.domain !== domain) return false;
    if (system !== "all" && !(system in (asset.systems ?? {}))) return false;
    if (!normalizedQuery) return true;
    return normalizeText([asset.title, asset.action, asset.evidence, asset.domain].join(" ")).includes(normalizedQuery);
  });
}

export function assetLeverage(asset) {
  return Object.keys(asset?.systems ?? {}).length;
}

export function exportMeritMapMarkdown(scenario, data, generatedOn = new Date()) {
  const tradeoffs = calculateTradeoffRanking(data.tradeoffOptions ?? [], { objective: "balanced", capacityHours: 8 });
  const lines = [
    `# ${data.title}`,
    "",
    `Generado: ${generatedOn.toISOString().slice(0, 10)} · Fuentes revisadas: ${data.reviewedOn}`,
    "",
    "> Herramienta personal y no oficial. Los cálculos son parciales y orientativos; prevalecen los baremos y convocatorias vigentes.",
    "",
    "## Lectura ANECA CU",
    "",
    "| Bloque | Subtotal configurado | Mínimos visibles |",
    "|---|---:|---|",
    ...scenario.blocks.map((block) => `| ${block.label} | ${formatNumber(block.subtotal)} puntos parciales | ${block.minimumStatus} |`),
    "",
    "## Prioridades personales",
    "",
    ...scenario.priorities.map((item, index) => `${index + 1}. **${item.title}.** ${item.reason}`),
    "",
    "## Trade-offs · supuesto de equilibrio y 8 h/semana de pico",
    "",
    "> Índice heurístico personal de 1 a 5; no es baremo ni probabilidad de éxito.",
    "",
    "| Ruta | Encaje | Valor | Carga | Capacidad |",
    "|---|---:|---:|---:|---|",
    ...tradeoffs.routes.map((route) => `| ${route.title} | ${formatNumber(route.priorityIndex)}/5 | ${formatNumber(route.strategicValue)}/5 | ${formatNumber(route.burden)}/5 | ${route.effortMin}–${route.effortMax} h/semana · ${route.capacityState} |`),
    "",
    "## Activos de alto apalancamiento",
    "",
    ...[...data.assets].sort((left, right) => assetLeverage(right) - assetLeverage(left)).slice(0, 6).map((asset) => `- **${asset.title}** · conecta con ${assetLeverage(asset)} sistemas. Evidencia: ${asset.evidence}`),
    "",
    "## Fuentes",
    "",
    ...data.sources.map((source) => `- [${source.label}](${source.url})`),
    ""
  ];
  return lines.join("\n");
}

function calculateResearch(profile) {
  const components = [];
  const sexenniumPoints = Math.min(profile.sexennia, 4) * 10;
  if (sexenniumPoints) components.push(component("Sexenios reconocidos", sexenniumPoints, `${profile.sexennia} × 10; hasta cuatro para el máximo automático de 1.2.1`, "aneca-research"));
  if (profile.ipAllocation === "research" && profile.stateIpYears >= 3) components.push(component("Proyecto estatal como IP", 10, "Tres años como IP en convocatoria competitiva estatal", "aneca-research"));
  if (profile.stateMemberYears >= 3) components.push(component("Proyecto estatal como miembro", 2, "Tres años como miembro en convocatoria competitiva estatal", "aneca-research"));
  if (profile.qualifyingStays) components.push(component("Estancias internacionales", Math.min(profile.qualifyingStays, 6) * 5, "Cada estancia configurada representa tres meses con resultados contrastables", "aneca-research"));
  return {
    id: "research",
    label: "Investigación y transferencia",
    subtotal: cap100(sumPoints(components)),
    components,
    minimumStatus: profile.sexennia >= 3
      ? "Tres sexenios cubren automáticamente el mínimo de actividad investigadora 1.2.1."
      : `${profile.sexennia}/3 sexenios hacia el mínimo automático de 1.2.1; también puede acreditarse con contribuciones no usadas.`,
    caveat: "Este subtotal no incluye resultados 1.2, transferencia, divulgación ni otros méritos y no equivale a la puntuación completa del bloque."
  };
}

function scoreTradeoffOption(option, weights, capacityHours) {
  const benefitKeys = ["cu", "funding", "independence", "transfer", "international"];
  const weightedValue = benefitKeys.reduce((sum, key) => sum + boundedScore(option.benefits?.[key]) * weights[key], 0);
  const weightTotal = benefitKeys.reduce((sum, key) => sum + weights[key], 0);
  const strategicValue = round1(weightedValue / weightTotal);
  const burden = round1(["time", "uncertainty", "dependency"].reduce((sum, key) => sum + boundedScore(option.burdens?.[key]), 0) / 3);
  const readiness = boundedScore(option.readiness);
  const effortMin = integer(option.effortHours?.[0], 0, 40, 0);
  const effortMax = integer(option.effortHours?.[1], effortMin, 40, effortMin);
  const capacityState = capacityHours < effortMin ? "overload" : capacityHours < effortMax ? "tight" : "comfortable";
  const capacityPenalty = capacityState === "overload" ? 1.25 : capacityState === "tight" ? 0.35 : 0;
  const priorityIndex = round1(Math.max(1, Math.min(5, strategicValue + (readiness - 3) * 0.2 - (burden - 3) * 0.18 - capacityPenalty)));
  return { ...option, strategicValue, burden, readiness, effortMin, effortMax, capacityState, priorityIndex };
}

function findComplement(ranked) {
  const primary = ranked[0];
  if (!primary) return null;
  return ranked.find((route) => route.id !== primary.id && route.capacityState !== "overload" && route.cluster !== primary.cluster)
    ?? ranked.find((route) => route.id !== primary.id && route.capacityState !== "overload")
    ?? null;
}

function calculateTeaching(profile) {
  const components = [];
  if (profile.openManuals) components.push(component("Manuales abiertos", Math.min(profile.openManuals, 5) * 1.5, "Manual abierto de una asignatura; máximo de cinco contribuciones configuradas", "aneca-teaching"));
  if (profile.tfg6) components.push(component("TFG de 6 ECTS", Math.min(profile.tfg6, 6) * 0.5, "Dirección individual; máximo de seis contribuciones configuradas", "aneca-teaching"));
  if (profile.collaborationScholarships) components.push(component("Becas de colaboración tutorizadas", Math.min(profile.collaborationScholarships, 6) * 2, "Una beca durante un curso; máximo de seis contribuciones configuradas", "aneca-teaching"));
  if (profile.erasmusYears) components.push(component("Proyectos Erasmus+", Math.min(profile.erasmusYears, 6) * 5, "Participación durante un año; máximo de seis contribuciones configuradas", "aneca-teaching"));
  if (profile.teacherTrainingBlocks) components.push(component("Formación docente impartida", Math.min(profile.teacherTrainingBlocks, 6) * 3, "Cada bloque representa 20 horas impartidas", "aneca-teaching"));
  return {
    id: "teaching",
    label: "Docencia",
    subtotal: cap100(sumPoints(components)),
    components,
    minimumStatus: profile.quinquennia >= 2
      ? "Dos quinquenios positivos cubren el mínimo de experiencia docente CU."
      : `${profile.quinquennia}/2 quinquenios hacia el mínimo alternativo; en su defecto se exigen 10 años a tiempo completo y 140 ECTS/1.400 horas.`,
    caveat: "La experiencia mínima no da por sí sola los 50 puntos del bloque. Falta evaluar calidad docente —por ejemplo DOCENTIA— y el resto de contribuciones."
  };
}

function calculateLeadership(profile) {
  const components = [];
  let teamPeriods = Math.min(profile.otherTeamLeadershipPeriods, 3);
  if (profile.ipAllocation === "leadership" && profile.stateIpYears >= 4) teamPeriods = Math.min(3, teamPeriods + 1);
  if (teamPeriods) components.push(component("Dirección de equipos", teamPeriods * 10, "Cada periodo configurado representa al menos cuatro años con liderazgo y resultados", "aneca-leadership"));

  const thesis = calculateThesisContributions(profile);
  if (thesis.points) components.push(component("Tesis y TFM defendidos", thesis.points, `${thesis.used} de 10 contribuciones posibles`, "aneca-leadership"));
  if (profile.managementPeriods) components.push(component("Dirección o gestión", Math.min(profile.managementPeriods, 5) * 10, "Cada periodo configurado representa al menos cuatro años con impacto", "aneca-leadership"));
  if (profile.scientificResponsibilityPeriods) components.push(component("Responsabilidad científico-técnica", Math.min(profile.scientificResponsibilityPeriods, 5) * 10, "Cada periodo configurado representa al menos cuatro años", "aneca-leadership"));
  return {
    id: "leadership",
    label: "Liderazgo",
    subtotal: cap100(sumPoints(components)),
    components,
    minimumStatus: thesis.points >= 10
      ? `Mínimo obligatorio 3.2 alcanzado de forma orientativa (${formatNumber(thesis.points)}/10).`
      : `Mínimo obligatorio 3.2 pendiente (${formatNumber(thesis.points)}/10): una tesis individual o dos codirecciones defendidas orientan a 10 puntos.`,
    caveat: "La comisión valora visión, cambios, resultados e impacto. La mera denominación de IP, cargo o tutoría no basta."
  };
}

function calculateThesisContributions(profile) {
  let remaining = 10;
  let points = 0;
  const individual = Math.min(profile.individualTheses, remaining);
  points += individual * 10;
  remaining -= individual;
  const coDirected = Math.min(profile.coDirectedTheses, remaining);
  points += coDirected * 5;
  remaining -= coDirected;
  const tfm = Math.min(profile.tfm9, remaining);
  points += tfm;
  remaining -= tfm;
  return { points, used: 10 - remaining };
}

function buildPriorities(profile, research, teaching, leadership) {
  const priorities = [];
  const leadershipThesis = leadership.components.find((item) => item.label === "Tesis y TFM defendidos")?.points ?? 0;
  if (leadershipThesis < 10) priorities.push({ id: "thesis", title: "Construir la primera tesis defendida", reason: "Es el hueco cuantificado más nítido: el apartado 3.2 exige al menos 10 puntos y una dirección individual —o dos codirecciones— puede cubrirlos orientativamente." });
  if (profile.sexennia < 3) priorities.push({ id: "sexennia", title: "Encadenar resultados hacia los siguientes sexenios", reason: `Tienes ${profile.sexennia}; tres cubren automáticamente el mínimo de actividad investigadora 1.2.1 para CU y cuatro su máximo, sin resolver por ello todo el bloque.` });
  if (profile.quinquennia < 2) priorities.push({ id: "quinquennia", title: "Cerrar el segundo quinquenio y el registro docente", reason: "Dos quinquenios cubren el mínimo de experiencia CU; conserva además calidad, innovación y resultados porque el mínimo temporal no completa el bloque." });
  if (profile.stateIpYears < 3) priorities.push({ id: "pid", title: "Convertir GE en plataforma para un proyecto estatal", reason: "El proyecto estatal se evalúa sobre todo por propuesta y equipo; como mérito futuro, tres años de IP estatal orientan a 10 puntos de investigación CU." });
  if (!profile.qualifyingStays) priorities.push({ id: "stay", title: "Diseñar una colaboración internacional con resultado", reason: "Una estancia de tres meses con resultados orienta a 5 puntos y refuerza internacionalización en proyectos, R3 y futuras propuestas ERC." });
  return priorities.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1, researchSubtotal: research.subtotal, teachingSubtotal: teaching.subtotal }));
}

function normalizeProfile(raw) {
  const profile = {};
  for (const key of Object.keys(MERIT_PROFILE_DEFAULTS)) {
    profile[key] = key === "ipAllocation"
      ? (["research", "leadership"].includes(raw[key]) ? raw[key] : MERIT_PROFILE_DEFAULTS[key])
      : integer(raw[key], 0, 20, MERIT_PROFILE_DEFAULTS[key]);
  }
  profile.stateIpYears = integer(raw.stateIpYears, 0, 12, 0);
  profile.stateMemberYears = integer(raw.stateMemberYears, 0, 12, 0);
  return profile;
}

function component(label, points, detail, sourceId) { return { label, points, detail, sourceId }; }
function sumPoints(items) { return items.reduce((sum, item) => sum + item.points, 0); }
function cap100(value) { return Math.min(100, value); }
function integer(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback; }
function normalizeText(value) { return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim(); }
function formatNumber(value) { return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value); }
function boundedScore(value) { const number = Number(value); return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : 1; }
function round1(value) { return Math.round(value * 10) / 10; }
function requireScore(value, label) { if (!Number.isFinite(value) || value < 1 || value > 5) throw new RangeError(`Escala 1–5 inválida: ${label}`); }
function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (!item?.id || ids.has(item.id)) throw new Error(`Identificador de ${label} ausente o duplicado: ${item?.id ?? ""}`);
    ids.add(item.id);
  }
  return ids;
}
