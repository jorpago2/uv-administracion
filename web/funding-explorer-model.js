export const FUNDING_LEVELS = Object.freeze({
  european: "Unión Europea",
  state: "Estado",
  regional: "Comunitat Valenciana",
  uv: "Universitat de València",
  private: "Financiación privada"
});

export const FUNDING_PURPOSES = Object.freeze({
  frontier: "Investigación de frontera",
  collaborative: "Proyecto colaborativo",
  career: "Contratación y carrera",
  transfer: "Prueba de concepto y transferencia",
  network: "Redes e internacionalización",
  equipment: "Equipamiento e infraestructura",
  group: "Fortalecimiento de grupos",
  business: "I+D con empresas",
  outreach: "Cultura científica"
});

export const FUNDING_PARTICIPATION = Object.freeze({
  individual: "Individual o un único beneficiario",
  consortium: "Consorcio o colaboración obligatoria",
  institutional: "Solicitud institucional",
  both: "Individual o consorcio"
});

export const FUNDING_BENEFICIARIES = Object.freeze({
  university: "Universidad u organismo de investigación",
  company: "Empresa",
  researcher: "Persona investigadora"
});

export const FUNDING_PROFILES = Object.freeze({
  "early-career": "IP al inicio de carrera",
  postdoc: "Persona postdoctoral",
  predoc: "Persona predoctoral",
  "emerging-group": "Grupo emergente",
  "consolidated-group": "Grupo consolidado",
  "excellent-group": "Grupo de excelencia",
  "erc-grantee": "IP o resultado ERC",
  technical: "Personal técnico",
  company: "Proyecto con empresa"
});

export const FUNDING_FREQUENCIES = Object.freeze({
  annual: "Habitualmente anual",
  recurrent: "Recurrente, no necesariamente anual",
  periodic: "Periodicidad variable",
  open: "Ventanilla abierta o negociación continua"
});

export const TRACEABILITY_LABELS = Object.freeze({
  programme: "Programa estable; revisar la edición",
  edition: "Condiciones dependientes de la edición",
  calendar: "Calendario especialmente variable"
});

const VALID_LEVELS = new Set(Object.keys(FUNDING_LEVELS));
const VALID_PURPOSES = new Set(Object.keys(FUNDING_PURPOSES));
const VALID_PARTICIPATION = new Set(Object.keys(FUNDING_PARTICIPATION));
const VALID_BENEFICIARIES = new Set(Object.keys(FUNDING_BENEFICIARIES));
const VALID_PROFILES = new Set(Object.keys(FUNDING_PROFILES));
const VALID_FREQUENCIES = new Set(Object.keys(FUNDING_FREQUENCIES));
const VALID_STABILITY = new Set(Object.keys(TRACEABILITY_LABELS));

export function validateFundingData(data) {
  if (!data || data.schemaVersion !== 1 || !isIsoDate(data.reviewedOn)) {
    throw new Error("El catálogo de financiación no tiene el formato esperado.");
  }
  if (!Array.isArray(data.calls) || !data.calls.length) {
    throw new Error("No hay convocatorias disponibles.");
  }
  const ids = data.calls.map((call) => call.id);
  if (new Set(ids).size !== ids.length) throw new Error("Hay convocatorias con identificadores duplicados.");
  data.calls.forEach(validateCall);
  return data;
}

export function filterFundingCalls(calls, criteria = {}) {
  const query = normalizeText(criteria.query || "");
  const selectedTrl = criteria.trl === undefined || criteria.trl === "all" ? null : Number(criteria.trl);
  return calls.filter((call) => {
    if (criteria.level && criteria.level !== "all" && call.level !== criteria.level) return false;
    if (criteria.purpose && criteria.purpose !== "all" && !call.purposes.includes(criteria.purpose)) return false;
    if (criteria.participation && criteria.participation !== "all" && !matchesParticipation(call.participation, criteria.participation)) return false;
    if (criteria.beneficiary && criteria.beneficiary !== "all" && !call.beneficiaries.includes(criteria.beneficiary)) return false;
    if (criteria.profile && criteria.profile !== "all" && !call.profiles.includes(criteria.profile)) return false;
    if (criteria.frequency && criteria.frequency !== "all" && call.frequency !== criteria.frequency) return false;
    if (selectedTrl !== null && (!call.trl || selectedTrl < call.trl.min || selectedTrl > call.trl.max)) return false;
    if (!query) return true;
    const searchable = buildSearchText(call);
    return query.split(/\s+/).every((term) => searchable.includes(term));
  });
}

export function updateComparison(selection, callId, limit = 3) {
  const current = Array.isArray(selection) ? [...selection] : [];
  const existing = current.indexOf(callId);
  if (existing >= 0) {
    current.splice(existing, 1);
    return { selection: current, changed: true, reason: "removed" };
  }
  if (current.length >= limit) return { selection: current, changed: false, reason: "limit" };
  current.push(callId);
  return { selection: current, changed: true, reason: "added" };
}

export function buildComparisonRows(calls) {
  if (!Array.isArray(calls) || !calls.length) return [];
  return [
    { label: "Nivel", values: calls.map((call) => FUNDING_LEVELS[call.level]) },
    { label: "Finalidad", values: calls.map((call) => call.purposes.map((value) => FUNDING_PURPOSES[value]).join("; ")) },
    { label: "Perfil o solicitante", values: calls.map((call) => call.profile) },
    { label: "Participación", values: calls.map((call) => FUNDING_PARTICIPATION[call.participation]) },
    { label: "TRL orientativo", values: calls.map((call) => call.trl ? `${call.trl.min}–${call.trl.max}` : "No es el criterio principal") },
    { label: "Duración", values: calls.map((call) => call.duration) },
    { label: "Financiación", values: calls.map((call) => call.budget) },
    { label: "Tasa e indirectos", values: calls.map((call) => `${call.fundingRate}; ${call.indirectCosts}`) },
    { label: "Periodicidad", values: calls.map((call) => `${FUNDING_FREQUENCIES[call.frequency]}. ${call.calendar}`) },
    { label: "Condición crítica", values: calls.map((call) => call.critical) },
    { label: "Referencia", values: calls.map((call) => `Edición ${call.editionReference}; revisada ${formatIsoDate(call.verifiedOn)}`) }
  ];
}

export function getTraceabilityStatus(call, today = new Date()) {
  const verified = parseIsoDate(call.verifiedOn);
  const reference = today instanceof Date ? today : new Date(today);
  if (Number.isNaN(reference.getTime())) throw new TypeError("La fecha de referencia no es válida.");
  const ageDays = Math.floor((Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()) - verified.getTime()) / 86400000);
  if (ageDays > 365) return { id: "stale", label: "Revisión caducada", ageDays };
  if (ageDays > 180) return { id: "review", label: "Conviene revisar", ageDays };
  return { id: "current", label: "Fuente revisada", ageDays };
}

export function formatIsoDate(value) {
  const date = parseIsoDate(value);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function validateCall(call) {
  const strings = ["id", "name", "shortName", "level", "profile", "participation", "duration", "budget", "fundingRate", "indirectCosts", "frequency", "calendar", "critical", "editionReference", "verifiedOn", "stability"];
  if (strings.some((field) => typeof call[field] !== "string" || !call[field].trim())) throw new Error(`Convocatoria incompleta: ${call.id || "sin identificador"}.`);
  if (!VALID_LEVELS.has(call.level)) throw new Error(`Nivel no válido en ${call.id}.`);
  if (!VALID_PARTICIPATION.has(call.participation)) throw new Error(`Participación no válida en ${call.id}.`);
  if (!VALID_FREQUENCIES.has(call.frequency)) throw new Error(`Periodicidad no válida en ${call.id}.`);
  if (!VALID_STABILITY.has(call.stability)) throw new Error(`Estabilidad no válida en ${call.id}.`);
  if (!Array.isArray(call.purposes) || !call.purposes.length || !call.purposes.every((value) => VALID_PURPOSES.has(value))) throw new Error(`Finalidad no válida en ${call.id}.`);
  if (!Array.isArray(call.beneficiaries) || !call.beneficiaries.length || !call.beneficiaries.every((value) => VALID_BENEFICIARIES.has(value))) throw new Error(`Beneficiario no válido en ${call.id}.`);
  if (!Array.isArray(call.profiles) || !call.profiles.every((value) => VALID_PROFILES.has(value))) throw new Error(`Perfil filtrable no válido en ${call.id}.`);
  if (call.trl !== null && (!Number.isInteger(call.trl?.min) || !Number.isInteger(call.trl?.max) || call.trl.min < 1 || call.trl.max > 9 || call.trl.min > call.trl.max)) throw new Error(`TRL no válido en ${call.id}.`);
  if (!isIsoDate(call.verifiedOn)) throw new Error(`Fecha de verificación no válida en ${call.id}.`);
  if (!call.source || typeof call.source.label !== "string" || typeof call.source.url !== "string") throw new Error(`Fuente incompleta en ${call.id}.`);
  try {
    const url = new URL(call.source.url);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`Fuente no válida en ${call.id}.`);
  }
}

function matchesParticipation(actual, requested) {
  if (actual === requested) return true;
  return actual === "both" && ["individual", "consortium"].includes(requested);
}

function buildSearchText(call) {
  return normalizeText([
    call.name,
    call.shortName,
    FUNDING_LEVELS[call.level],
    call.profile,
    call.duration,
    call.budget,
    call.calendar,
    call.critical,
    ...call.purposes.map((value) => FUNDING_PURPOSES[value]),
    ...call.profiles.map((value) => FUNDING_PROFILES[value])
  ].join(" "));
}

function normalizeText(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function isIsoDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = parseIsoDate(value);
  return !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() + 1 === Number(match[2])
    && date.getUTCDate() === Number(match[3]);
}

function parseIsoDate(value) {
  return new Date(`${value}T00:00:00Z`);
}
