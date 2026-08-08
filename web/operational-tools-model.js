export const AREA_LABELS = Object.freeze({
  planificacion: "Orientación y gobierno",
  docencia: "Docencia",
  pdi: "Carrera y condiciones PDI",
  investigacion: "Investigación y transferencia",
  gestion: "Gestión administrativa",
  cumplimiento: "Cumplimiento y derechos"
});

const VALID_ROLES = new Set(["docente", "ip", "tutor", "responsable"]);
const VALID_MOMENTS = new Set(["preparar", "tramitar", "incidencia", "cerrar"]);

export function validateOperationsData(data) {
  if (!data || data.schemaVersion !== 1 || typeof data.reviewedOn !== "string") {
    throw new Error("Los datos operativos no tienen el formato esperado.");
  }
  if (!Array.isArray(data.procedures) || !data.procedures.length) {
    throw new Error("No hay fichas de procedimiento disponibles.");
  }
  if (!Array.isArray(data.milestones) || !data.milestones.length) {
    throw new Error("No hay hitos de calendario disponibles.");
  }

  assertUniqueIds(data.procedures, "fichas");
  assertUniqueIds(data.milestones, "hitos");
  data.procedures.forEach(validateProcedure);
  data.milestones.forEach(validateMilestone);
  return data;
}

export function recommendProcedures(procedures, criteria, limit = 4) {
  const area = criteria.area || "all";
  const role = criteria.role || "all";
  const moment = criteria.moment || "all";
  return procedures
    .map((procedure) => ({
      procedure,
      score: (area !== "all" && procedure.area === area ? 8 : 0)
        + (role !== "all" && procedure.roles.includes(role) ? 3 : 0)
        + (moment !== "all" && procedure.moments.includes(moment) ? 2 : 0)
        + (area === "all" && role === "all" && moment === "all" && procedure.featured === true ? 1 : 0)
    }))
    .filter(({ procedure }) => area === "all" || procedure.area === area)
    .sort((left, right) => right.score - left.score || left.procedure.title.localeCompare(right.procedure.title, "es"))
    .slice(0, Math.max(1, limit))
    .map(({ procedure }) => procedure);
}

export function filterProcedures(procedures, area = "all", query = "") {
  const normalizedQuery = normalizeText(query);
  return procedures.filter((procedure) => {
    if (area !== "all" && procedure.area !== area) return false;
    if (!normalizedQuery) return true;
    const searchable = normalizeText([
      procedure.title,
      procedure.summary,
      procedure.unit,
      procedure.deadline,
      procedure.channel,
      ...procedure.documents,
      ...procedure.steps
    ].join(" "));
    return searchable.includes(normalizedQuery);
  });
}

export function buildIcsCalendar(milestones, year, baseUrl, generatedAt = new Date()) {
  const numericYear = Number(year);
  if (!Number.isInteger(numericYear) || numericYear < 2020 || numericYear > 2100) {
    throw new RangeError("El año del calendario no es válido.");
  }
  if (!Array.isArray(milestones) || !milestones.length) {
    throw new Error("Selecciona al menos un recordatorio.");
  }

  const stamp = toUtcStamp(generatedAt);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Guia operativa UV//Calendario anual//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`Guía operativa UV ${numericYear}`)}`
  ];

  milestones.forEach((milestone) => {
    const start = toDateValue(numericYear, milestone.month, milestone.day);
    const endDate = new Date(Date.UTC(numericYear, milestone.month - 1, milestone.day + 1));
    const end = toDateValue(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate());
    const url = `${String(baseUrl).replace(/#.*$/, "")}#${milestone.anchor}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${milestone.id}-${numericYear}@guia-operativa-uv`)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcsText(`Revisión interna · ${milestone.title}`)}`,
      `DESCRIPTION:${escapeIcsText(`${milestone.description}\nRecordatorio orientativo: confirma siempre el calendario o convocatoria oficial.`)}`,
      `CATEGORIES:${escapeIcsText(AREA_LABELS[milestone.area] || milestone.area)}`,
      `URL:${escapeIcsText(url)}`,
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function formatReviewedDate(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function validateProcedure(procedure) {
  const stringFields = ["id", "title", "summary", "area", "anchor", "unit", "deadline", "channel", "risk", "sourceLabel", "sourceUrl", "validity"];
  if (stringFields.some((field) => typeof procedure[field] !== "string" || !procedure[field].trim())) {
    throw new Error(`Ficha incompleta: ${procedure.id || "sin identificador"}.`);
  }
  if (!AREA_LABELS[procedure.area]) throw new Error(`Ámbito desconocido en ${procedure.id}.`);
  if (!Number.isInteger(procedure.chapter) || procedure.chapter < 1) throw new Error(`Capítulo no válido en ${procedure.id}.`);
  if (!Array.isArray(procedure.roles) || !procedure.roles.every((role) => VALID_ROLES.has(role))) throw new Error(`Roles no válidos en ${procedure.id}.`);
  if (!Array.isArray(procedure.moments) || !procedure.moments.every((moment) => VALID_MOMENTS.has(moment))) throw new Error(`Momentos no válidos en ${procedure.id}.`);
  if (!["stable", "annual"].includes(procedure.validity)) throw new Error(`Vigencia no válida en ${procedure.id}.`);
  if (procedure.featured !== undefined && typeof procedure.featured !== "boolean") throw new Error(`Marca destacada no válida en ${procedure.id}.`);
  if (!Array.isArray(procedure.documents) || procedure.documents.length < 2) throw new Error(`Documentación insuficiente en ${procedure.id}.`);
  if (!Array.isArray(procedure.steps) || procedure.steps.length < 3) throw new Error(`Pasos insuficientes en ${procedure.id}.`);
  try { new URL(procedure.sourceUrl); } catch { throw new Error(`Fuente no válida en ${procedure.id}.`); }
}

function validateMilestone(milestone) {
  if (!milestone?.id || !milestone.title || !milestone.description || !milestone.anchor) throw new Error("Hito de calendario incompleto.");
  if (!Number.isInteger(milestone.month) || milestone.month < 1 || milestone.month > 12) throw new Error(`Mes no válido en ${milestone.id}.`);
  if (!Number.isInteger(milestone.day) || milestone.day < 1 || milestone.day > 31) throw new Error(`Día no válido en ${milestone.id}.`);
  if (!AREA_LABELS[milestone.area]) throw new Error(`Ámbito desconocido en ${milestone.id}.`);
}

function assertUniqueIds(items, label) {
  const ids = items.map((item) => item.id);
  if (ids.some((id) => typeof id !== "string" || !id)) throw new Error(`Hay ${label} sin identificador.`);
  if (new Set(ids).size !== ids.length) throw new Error(`Hay identificadores duplicados en ${label}.`);
}

function normalizeText(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function escapeIcsText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function toDateValue(year, month, day) {
  return `${String(year).padStart(4, "0")}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function toUtcStamp(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError("La fecha de generación no es válida.");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const chunks = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (encoder.encode(current + character).length > limit && current) {
      chunks.push(current);
      current = character;
      limit = 74;
    } else current += character;
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n ");
}
