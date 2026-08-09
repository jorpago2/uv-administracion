export const PROFILE_DEFAULTS = Object.freeze({
  category: "ayudante-doctor",
  contractEnd: "",
  accreditation: "favorable",
  mobility: "likely",
  teaching: "likely",
  research: "portfolio",
  c1: "yes",
  sexennia: 0,
  projectRole: "ip",
  emergingProject: "awarded",
  defendedTheses: 0,
  weeklyHours: 6
});

export function buildCareerAssessment(rawProfile, data, asOf = new Date()) {
  const profile = normalizeProfile(rawProfile);
  let gates = [
    mobilityGate(profile.mobility),
    teachingGate(profile.teaching),
    researchGate(profile.research, profile.sexennia),
    languageGate(profile.c1),
    accreditationGate(profile.accreditation),
    contractGate(profile.contractEnd, asOf),
    projectGate(profile.emergingProject, profile.projectRole)
  ];
  if (profile.accreditation === "favorable") gates = closePtuGates(gates);
  const ptuInputs = gates.slice(0, 3);
  const ptuEvidenceReady = ptuInputs.every((gate) => gate.status === "ready");
  const ptuLooksPlausible = ptuInputs.every((gate) => ["ready", "evidence"].includes(gate.status));
  const stage = careerStage(profile, ptuEvidenceReady, ptuLooksPlausible);
  const priorities = choosePriorities(profile, data.actions, ptuEvidenceReady);

  return {
    profile,
    stage,
    headline: headlineFor(stage),
    interpretation: interpretationFor(stage),
    gates,
    priorities,
    roadmap: buildRoadmap(profile, priorities),
    weeklyAllocation: allocateWeeklyTime(profile, stage),
    warnings: buildWarnings(profile, gates, asOf)
  };
}

export function evaluateOpportunity(rawOpportunity) {
  const opportunity = {
    gate: Boolean(rawOpportunity.gate),
    reusable: Boolean(rawOpportunity.reusable),
    concreteOutput: Boolean(rawOpportunity.concreteOutput),
    fundingOrNetwork: Boolean(rawOpportunity.fundingOrNetwork),
    leadership: Boolean(rawOpportunity.leadership),
    hours: clampNumber(rawOpportunity.hours, 0, 80, 0),
    displacesCore: Boolean(rawOpportunity.displacesCore),
    recurring: Boolean(rawOpportunity.recurring)
  };
  const benefit = (opportunity.gate ? 30 : 0)
    + (opportunity.reusable ? 20 : 0)
    + (opportunity.concreteOutput ? 18 : 0)
    + (opportunity.fundingOrNetwork ? 14 : 0)
    + (opportunity.leadership ? 8 : 0);
  const cost = Math.min(20, opportunity.hours / 2)
    + (opportunity.displacesCore ? 24 : 0)
    + (opportunity.recurring ? 12 : 0);
  const score = Math.round(clampNumber(50 + benefit - cost, 0, 100, 0));
  const verdict = score >= 75 ? "prioritize" : score >= 55 ? "condition" : "decline";
  const label = verdict === "prioritize" ? "Priorizar" : verdict === "condition" ? "Aceptar solo con condiciones" : "Posponer o rechazar";
  return { score, verdict, label, benefit: Math.round(benefit), cost: Math.round(cost) };
}

export function exportCareerRoadmapMarkdown(assessment, data, generatedOn = new Date()) {
  const statusLabel = { ready: "resuelto", evidence: "verificar evidencia", gap: "brecha", waiting: "en curso", future: "posterior" };
  const lines = [
    `# ${data.title}`,
    "",
    `Generado: ${isoDate(generatedOn)} · Datos normativos revisados: ${data.reviewedOn}`,
    "",
    "> Documento personal de trabajo. No es oficial, no garantiza acreditación ni plaza y debe contrastarse con la convocatoria vigente.",
    "",
    `## Diagnóstico: ${assessment.headline}`,
    "",
    assessment.interpretation,
    "",
    "## Puertas de paso",
    "",
    "| Elemento | Estado | Siguiente evidencia o acción |",
    "|---|---|---|",
    ...assessment.gates.map((gate) => `| ${gate.label} | ${statusLabel[gate.status]} | ${gate.next} |`),
    "",
    "## Tres prioridades",
    "",
    ...assessment.priorities.map((action, index) => `${index + 1}. **${action.title}.** ${action.deliverable}`),
    "",
    "## Hoja de ruta",
    ""
  ];
  for (const phase of assessment.roadmap) {
    lines.push(`### ${phase.label}`, "", ...phase.items.map((item) => `- ${item}`), "");
  }
  lines.push("## Reparto semanal del tiempo discrecional", "");
  for (const item of assessment.weeklyAllocation) lines.push(`- ${item.label}: ${item.hours} h/semana (${item.percent} %).`);
  lines.push("", "## Fuentes", "", ...data.sources.map((source) => `- [${source.label}](${source.url})`), "");
  return lines.join("\n");
}

function normalizeProfile(raw = {}) {
  return {
    category: String(raw.category || PROFILE_DEFAULTS.category),
    contractEnd: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.contractEnd || "")) ? String(raw.contractEnd) : "",
    accreditation: allowed(raw.accreditation, ["not-started", "preparing", "submitted", "favorable"], PROFILE_DEFAULTS.accreditation),
    mobility: allowed(raw.mobility, ["unknown", "incomplete", "likely", "certified", "exempt"], PROFILE_DEFAULTS.mobility),
    teaching: allowed(raw.teaching, ["unknown", "below", "likely", "certified", "quinquennium"], PROFILE_DEFAULTS.teaching),
    research: allowed(raw.research, ["unknown", "developing", "portfolio", "sexennium"], PROFILE_DEFAULTS.research),
    c1: allowed(raw.c1, ["unknown", "no", "yes"], PROFILE_DEFAULTS.c1),
    sexennia: Math.round(clampNumber(raw.sexennia, 0, 6, PROFILE_DEFAULTS.sexennia)),
    projectRole: allowed(raw.projectRole, ["none", "member", "ip"], PROFILE_DEFAULTS.projectRole),
    emergingProject: allowed(raw.emergingProject, ["none", "awarded"], PROFILE_DEFAULTS.emergingProject),
    defendedTheses: Math.round(clampNumber(raw.defendedTheses, 0, 20, PROFILE_DEFAULTS.defendedTheses)),
    weeklyHours: clampNumber(raw.weeklyHours, 1, 30, PROFILE_DEFAULTS.weeklyHours)
  };
}

function mobilityGate(value) {
  if (["certified", "exempt"].includes(value)) return gate("mobility", "Movilidad PTU · 9 meses", "ready", "Conservar certificado y comprobar que ACADEMIA lo admite en el expediente.");
  if (value === "likely") return gate("mobility", "Movilidad PTU · 9 meses", "evidence", "Pedir a la UV certificado con fechas y actividades; el contrato en universidad distinta de la tesis puede computar.");
  return gate("mobility", "Movilidad PTU · 9 meses", "gap", value === "incomplete" ? "Completar el periodo o analizar una excepción antes de presentar." : "Reconstruir contratos/estancias y pedir a ANECA confirmación si el encaje no es claro.");
}

function teachingGate(value) {
  if (["certified", "quinquennium"].includes(value)) return gate("teaching", "Docencia PTU", "ready", value === "quinquennium" ? "Incorporar la evaluación positiva del quinquenio y sus certificados." : "Mapear certificados al mínimo que corresponde a cada figura contractual.");
  if (value === "likely") return gate("teaching", "Docencia PTU", "evidence", "Certificar por curso figura, dedicación, horas/ECTS, nivel, responsabilidad y calidad; calcular proporcionalmente la trayectoria mixta.");
  return gate("teaching", "Docencia PTU", "gap", value === "below" ? "Cuantificar exactamente el déficit y cubrir docencia evaluada, no horas genéricas." : "Solicitar hoja docente completa UV/UPV antes de estimar suficiencia.");
}

function researchGate(value, sexennia) {
  if (value === "sexennium" || sexennia > 0) return gate("research", "Investigación y transferencia PTU", "ready", "Usar el sexenio concedido como suficiencia automática del mínimo e identificar aportaciones adicionales si mejoran el expediente.");
  if (value === "portfolio") return gate("research", "Investigación y transferencia PTU", "evidence", "Simular los 50 puntos con hasta 8 resultados, contribución propia, proyectos, movilidad e impacto; no inferirlos por número de artículos.");
  return gate("research", "Investigación y transferencia PTU", "gap", "Construir una cartera evaluable y preparar el primer sexenio; priorizar calidad, contribución e independencia.");
}

function languageGate(value) {
  if (value === "yes") return gate("c1", "C1 de valenciano para promoción UV", "ready", "Confirmar que el certificado consta en el expediente personal UV.");
  if (value === "no") return gate("c1", "C1 de valenciano para promoción UV", "gap", "Abrir ya una vía de obtención reconocida; puede condicionar la transformación en la UV.");
  return gate("c1", "C1 de valenciano para promoción UV", "evidence", "Comprobar certificado reconocido y su incorporación al expediente; si no existe, tratarlo como brecha.");
}

function accreditationGate(value) {
  if (value === "favorable") return gate("accreditation", "Acreditación PTU", "ready", "Comunicar la resolución a la UV y seguir el ciclo de promoción/plaza aplicable.");
  if (value === "submitted") return gate("accreditation", "Acreditación PTU", "waiting", "Vigilar notificaciones y tener preparada una respuesta documental para subsanación o alegaciones.");
  return gate("accreditation", "Acreditación PTU", "gap", value === "preparing" ? "Cerrar la matriz de suficiencia y presentar cuando admisión, investigación y docencia estén acreditadas." : "Hacer una auditoría ACADEMIA antes de acumular más méritos sin objetivo.");
}

function contractGate(value, asOf) {
  if (!value) return gate("contract", "Fin de contrato y ventana UV", "evidence", "Consultar la fecha exacta en contrato/hoja de servicios y revisar cada nuevo acuerdo y oferta de empleo UV.");
  const end = new Date(`${value}T12:00:00`);
  const months = Math.round((end - asOf) / 2629800000);
  if (months < 0) return gate("contract", "Fin de contrato y ventana UV", "gap", "La fecha introducida ya ha pasado; corregir el dato o consultar inmediatamente a RR. HH. PDI.");
  if (months <= 18) return gate("contract", "Fin de contrato y ventana UV", "gap", `Quedan aproximadamente ${months} meses: confirmar por escrito transformación, requisitos y fechas de corte con DIE y RR. HH. PDI.`);
  return gate("contract", "Fin de contrato y ventana UV", "future", `Quedan aproximadamente ${months} meses; revisar anualmente los criterios UV y no esperar a la última convocatoria para acreditar.`);
}

function projectGate(value, role) {
  if (value !== "awarded") return gate("emerging-project", "Proyecto GVA Grupos Emergentes", "gap", "No consta una concesión activa; construir la siguiente oportunidad de financiación desde el hito científico prioritario.");
  const roleText = role === "ip" ? "como IP" : role === "member" ? "como miembro del equipo" : "con el papel nominal pendiente de corregir";
  return gate("emerging-project", "Proyecto GVA Grupos Emergentes", "ready", `Concedido, con inicio en septiembre de 2026 ${roleText}: cerrar antes del arranque presupuesto, responsables, compras/contratación, datos, protección y primer hito.`);
}

function closePtuGates(gates) {
  const completed = new Set(["mobility", "teaching", "research"]);
  return gates.map((item) => completed.has(item.id)
    ? { ...item, status: "ready", next: "Suficiencia ya superada en la acreditación PTU favorable; conservar resolución y evidencias para concurso, sexenio y futuras evaluaciones." }
    : item);
}

function careerStage(profile, ready, plausible) {
  if (profile.accreditation === "favorable") return "post-ptu";
  if (profile.accreditation === "submitted") return "waiting-ptu";
  if (ready) return "submit-ptu";
  if (plausible) return "document-ptu";
  return "build-ptu";
}

function headlineFor(stage) {
  return ({
    "post-ptu": "La prioridad es convertir la acreditación en promoción y construir independencia",
    "waiting-ptu": "La solicitud está en curso: protege la respuesta y sigue produciendo evidencia",
    "submit-ptu": "El expediente parece documentalmente listo para cerrar y presentar",
    "document-ptu": "Probablemente estás más cerca de PTU de lo que indica tu categoría",
    "build-ptu": "Primero hay que cerrar las brechas binarias de acceso a PTU"
  })[stage];
}

function interpretationFor(stage) {
  if (stage === "document-ptu") return "Tu trayectoria pública sugiere que puede existir masa crítica en investigación y docencia, pero ANECA evalúa contribuciones y certificados, no una impresión global. La acción de mayor retorno es comprobar suficiencia y convertir actividad pasada en evidencia válida.";
  if (stage === "submit-ptu") return "Los tres bloques previos aparecen acreditados según tus respuestas. Esto no garantiza evaluación favorable: cierra la narrativa, revisa las pruebas y presenta sin demoras artificiales.";
  if (stage === "post-ptu") return "La acreditación no crea una plaza. El foco inmediato es comunicarla y seguir el procedimiento UV; en paralelo, la carrera hacia CU exige independencia, financiación, dirección de personas y liderazgo sostenido.";
  if (stage === "waiting-ptu") return "No abras una segunda campaña documental. Mantén preparada la trazabilidad de la solicitud, responde a notificaciones y concentra el resto del tiempo en resultados reutilizables.";
  return "Ninguna publicación compensa un requisito de admisión incumplido. Identifica primero qué falta de verdad y dirige el esfuerzo al hueco concreto.";
}

function choosePriorities(profile, actions, ptuReady) {
  const ids = [];
  if (profile.accreditation !== "favorable" && !["certified", "exempt"].includes(profile.mobility)) ids.push("certify-mobility");
  if (profile.accreditation !== "favorable" && !["certified", "quinquennium"].includes(profile.teaching)) ids.push("certify-teaching");
  if (profile.c1 !== "yes") ids.push("obtain-c1");
  if (profile.accreditation === "not-started") ids.push("audit-academia");
  if ((ptuReady || profile.accreditation === "preparing") && profile.accreditation !== "favorable") ids.push("submit-ptu");
  if (profile.accreditation === "favorable") ids.push("notify-uv");
  if (profile.emergingProject === "awarded") ids.push("launch-ge-project", "research-pipeline");
  if (profile.sexennia === 0 && profile.research !== "sexennium") ids.push("first-sexennium");
  ids.push("funding-ladder", "evidence-bank", "research-pipeline", "student-pipeline");
  const unique = [...new Set(ids)];
  return unique.map((id) => actions.find((action) => action.id === id)).filter(Boolean).slice(0, 5);
}

function buildRoadmap(profile, priorities) {
  const first = priorities.slice(0, 3).map((item) => `${item.title}: ${item.deliverable}`);
  const ninety = [
    profile.emergingProject === "awarded" ? "Tener el proyecto GE en ejecución real: claves y elegibilidad confirmadas, primer pedido o contratación tramitado y primer hito técnico con responsable y criterio de éxito." : profile.accreditation === "favorable" ? "Registrar la acreditación en la UV y confirmar el siguiente ciclo de promoción." : "Cerrar una matriz PTU con evidencia, puntos orientativos, huecos y decisión presentar/no presentar.",
    profile.sexennia > 0 || profile.research === "sexennium" ? "Actualizar el banco de evidencias con el sexenio y seleccionar la siguiente cartera de resultados." : "Preparar cinco aportaciones y sustitutas para el primer sexenio, con contribución e impacto demostrables.",
    profile.emergingProject === "awarded" ? "Definir qué evidencia del GE habilitará la siguiente propuesta estatal o europea, sin precipitar una solicitud antes de producir ese resultado." : "Elegir una convocatoria que financie el siguiente hito técnico, con calendario inverso y alternativa si no se concede."
  ];
  const year = [
    "Conseguir una salida científica principal, un activo reproducible y una decisión de protección/transferencia dentro de la misma línea.",
    profile.projectRole === "ip" ? "Convertir el proyecto como IP en resultados, contratación/formación y siguiente propuesta." : "Pasar de miembro a responsable de un paquete o propuesta como IP con alcance ejecutable.",
    "Vincular TFG/TFM a módulos formativos del programa científico y medir una mejora docente real.",
    "Revisar el plan cada trimestre y eliminar actividades que consumen tiempo sin cerrar ninguna puerta ni producir un activo reutilizable."
  ];
  return [
    { id: "30", label: "Próximos 30 días · eliminar incertidumbre", items: first },
    { id: "90", label: "En 90 días · presentar o dejar un hueco cuantificado", items: ninety },
    { id: "365", label: "En 12 meses · activar el círculo virtuoso", items: year }
  ];
}

function allocateWeeklyTime(profile, stage) {
  let weights = stage === "post-ptu" && profile.emergingProject === "awarded"
    ? [["Ejecución científica del proyecto GE", 35], ["Producción y primer sexenio", 20], ["Equipo y liderazgo", 20], ["Siguiente financiación", 15], ["Docencia reutilizable", 10]]
    : stage === "post-ptu"
    ? [["Investigación y resultados", 35], ["Financiación e independencia", 25], ["Liderazgo y personas", 20], ["Docencia reutilizable", 10], ["Sistema de evidencias", 10]]
    : [["Acreditación y evidencias", 35], ["Investigación y sexenio", 30], ["Financiación", 20], ["Docencia reutilizable", 10], ["Sistema de evidencias", 5]];
  if (profile.c1 === "no" && stage !== "post-ptu") weights = [["C1 de valenciano", 20], ["Acreditación y evidencias", 30], ["Investigación y sexenio", 25], ["Financiación", 15], ["Docencia y evidencias", 10]];
  let assigned = 0;
  return weights.map(([label, percent], index) => {
    const hours = index === weights.length - 1 ? round1(profile.weeklyHours - assigned) : round1(profile.weeklyHours * percent / 100);
    assigned += hours;
    return { label, percent, hours };
  });
}

function buildWarnings(profile, gates, asOf) {
  const warnings = [profile.accreditation === "favorable" ? "La acreditación favorable habilita el siguiente paso, pero no equivale a una plaza ni a promoción automática." : "La herramienta ordena trabajo; no calcula ni predice una evaluación ANECA."];
  if (profile.accreditation !== "favorable" && profile.research === "portfolio" && profile.sexennia === 0) warnings.push("Veintiocho publicaciones listadas públicamente no equivalen por sí solas a 50 puntos ni a un sexenio.");
  const contract = gates.find((item) => item.id === "contract");
  if (contract.status === "evidence") warnings.push("Sin fecha final de contrato no puede determinarse tu ventana concreta de promoción UV.");
  if (asOf.getFullYear() > 2026) warnings.push("Los acuerdos UV citados son de 2026–2027: verifica si existe un ciclo posterior.");
  return warnings;
}

function gate(id, label, status, next) { return { id, label, status, next }; }
function allowed(value, values, fallback) { return values.includes(value) ? value : fallback; }
function clampNumber(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback; }
function round1(value) { return Math.round((value + Number.EPSILON) * 10) / 10; }
function isoDate(date) { return date.toISOString().slice(0, 10); }
