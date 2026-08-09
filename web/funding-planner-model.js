import { getRulePackage } from "./funding-planner-data.js";

export const ELIGIBILITY_STATUS = Object.freeze({
  pass: "Sin bloqueos detectados",
  review: "Debe verificarse",
  block: "No cumple con los datos indicados"
});

const STATUS_WEIGHT = Object.freeze({ pass: 0, review: 1, block: 2 });

export function evaluateEligibility(call, answers = {}, externalDeadline = "") {
  if (!call?.id) throw new Error("Selecciona una convocatoria válida.");
  const basePackage = getRulePackage(call.id);
  const rulePackage = basePackage.id === "company-led"
    ? { ...basePackage, editionReference: call.editionReference, source: call.source }
    : basePackage;
  const deadline = parseIsoDate(externalDeadline);
  const checks = evaluatePackage(rulePackage.id, call, answers, deadline);
  if (rulePackage.id === "generic") {
    checks.push(check("review", "Validación específica de la edición", "No existe todavía una regla específica para esta vía; revisa convocatoria, bases y cierre interno UV."));
  }
  const status = checks.reduce((current, item) => STATUS_WEIGHT[item.status] > STATUS_WEIGHT[current] ? item.status : current, "pass");
  return { status, label: ELIGIBILITY_STATUS[status], checks, rulePackage };
}

export function buildApplicationPlan(call, input, eligibility, today = new Date()) {
  if (!call?.id) throw new Error("Selecciona una convocatoria válida.");
  const external = requireIsoDate(input?.externalDeadline, "Indica una fecha límite externa válida.");
  const internal = input?.internalDeadline ? requireIsoDate(input.internalDeadline, "La fecha interna no es válida.") : null;
  if (internal && internal >= external) throw new Error("El cierre interno debe ser anterior a la fecha límite externa.");
  const safeToday = normalizeDate(today);
  const milestones = buildMilestones(external, internal).map((item) => ({
    ...item,
    isoDate: toIsoDate(item.date),
    state: item.date < safeToday ? "past" : item.date.getTime() === safeToday.getTime() ? "today" : "upcoming"
  }));
  const checklist = buildChecklist(call, eligibility);
  return {
    callId: call.id,
    callName: call.name,
    shortName: call.shortName,
    projectTitle: cleanText(input?.projectTitle) || `Candidatura ${call.shortName}`,
    role: input?.role || "pi",
    externalDeadline: toIsoDate(external),
    internalDeadline: internal ? toIsoDate(internal) : "",
    generatedOn: toIsoDate(safeToday),
    milestones,
    checklist,
    risks: buildRisks(call, eligibility, internal),
    source: call.source
  };
}

export function buildPlanMarkdown(plan, eligibility) {
  const lines = [
    `# ${plan.projectTitle}`,
    "",
    `**Convocatoria:** ${plan.callName}`,
    `**Resultado preliminar:** ${eligibility.label}`,
    `**Fecha límite externa:** ${formatIsoDate(plan.externalDeadline)}`,
    `**Cierre interno UV:** ${plan.internalDeadline ? formatIsoDate(plan.internalDeadline) : "pendiente de confirmar"}`,
    `**Generado:** ${formatIsoDate(plan.generatedOn)}`,
    "",
    "> Herramienta orientativa. La elegibilidad y el cierre interno deben confirmarse con la convocatoria oficial y la unidad UV competente.",
    "",
    "## Comprobación de elegibilidad",
    "",
    ...eligibility.checks.map((item) => `- **${statusMark(item.status)} ${item.label}:** ${item.detail}`),
    "",
    `Fuente de reglas: [${eligibility.rulePackage.source?.label || plan.source.label}](${eligibility.rulePackage.source?.url || plan.source.url}) · ${eligibility.rulePackage.editionReference}`,
    "",
    "## Calendario inverso",
    "",
    "| Fecha | Hito | Responsable | Estado al generar |",
    "|---|---|---|---|",
    ...plan.milestones.map((item) => `| ${formatIsoDate(item.isoDate)} | ${item.title} | ${item.owner} | ${milestoneState(item.state)} |`),
    "",
    "## Lista de trabajo",
    ""
  ];
  plan.checklist.forEach((group) => {
    lines.push(`### ${group.title}`, "", ...group.items.map((item) => `- [ ] ${item.task} — **${item.owner}**`), "");
  });
  lines.push("## Riesgos y decisiones pendientes", "", ...plan.risks.map((risk) => `- ${risk}`), "", `Fuente de convocatoria: [${plan.source.label}](${plan.source.url})`, "");
  return lines.join("\n");
}

export function buildPlanIcs(plan) {
  const events = plan.milestones.map((item, index) => {
    const start = item.isoDate.replaceAll("-", "");
    const end = toIsoDate(addDays(item.date, 1)).replaceAll("-", "");
    const uid = `${plan.callId}-${item.isoDate}-${index}@uv-guia.local`;
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcs(uid)}`,
      `DTSTAMP:${plan.generatedOn.replaceAll("-", "")}T120000Z`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcs(`${plan.shortName} · ${item.title}`)}`,
      `DESCRIPTION:${escapeIcs(`${plan.projectTitle}. Responsable: ${item.owner}. Comprueba siempre la fecha oficial.`)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    ];
  }).flat();
  const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Guía operativa UV//Planificador de financiación//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...events, "END:VCALENDAR", ""];
  return content.map(foldIcsLine).join("\r\n");
}

function evaluatePackage(packageId, call, answers, deadline) {
  if (packageId === "erc-career-2027") return evaluateErc(call, answers, deadline);
  if (packageId === "msca-pf-2026") return evaluateMsca(answers);
  if (packageId === "gva-ge-2026") return evaluateGe(answers);
  if (packageId === "gva-aico-2025") return evaluateAico(answers);
  if (packageId === "gva-prometeo-2025") return evaluatePrometeo(answers);
  if (packageId === "aei-pdc-2025") return evaluateBooleanSet(answers, [
    ["eligibleOrigin", "Proyecto de origen elegible", "La edición 2025 solo admite determinados proyectos de origen."],
    ["linkedResult", "Trazabilidad del resultado", "El resultado debe proceder del proyecto identificado."],
    ["sameExecutionForm", "Forma de ejecución", "Debe mantenerse la forma individual o coordinada, salvo las excepciones previstas."],
    ["valorisationNotContinuation", "Finalidad de valorización", "No puede ser mera continuación del proyecto de investigación."],
    ["rightsClear", "Titularidad y explotación", "La UV debe poder proteger y explotar o transferir el resultado."]
  ]);
  if (packageId === "eic-transition-2026") return evaluateEic(answers);
  if (packageId === "company-led") return evaluateCompany(answers);
  return evaluateBooleanSet(answers, [
    ["beneficiaryEligible", "Beneficiario admisible", "Debe confirmarse quién presenta y recibe la ayuda."],
    ["piEligible", "Elegibilidad de la persona", "Revisa categoría, vinculación, experiencia y dedicación."],
    ["compositionEligible", "Composición admisible", "Revisa entidad única, consorcio, socios y países."],
    ["topicFit", "Encaje temático", "La propuesta debe responder al alcance y resultados esperados."],
    ["resourcesAvailable", "Recursos disponibles", "Comprueba dedicación, cofinanciación e infraestructura."],
    ["internalDeadlineConfirmed", "Cierre interno UV", "Confirma fecha, circuito y firma institucional."]
  ]);
}

function evaluateErc(call, answers, deadline) {
  const checks = [];
  if (!deadline) checks.push(check("review", "Fecha límite", "Indícala para calcular la ventana doctoral."));
  const phd = parseIsoDate(answers.phdDate);
  const extension = optionalNumber(answers.extensionMonths);
  if (!phd) {
    checks.push(check("review", "Fecha de doctorado", "Falta la fecha de defensa del primer doctorado."));
  } else if (deadline) {
    const cutoff = new Date(2027, 0, 1);
    const extensionMonths = extension ?? 0;
    const earliest = subtractMonths(cutoff, (call.id === "erc-starting" ? 10 : 15) * 12 + extensionMonths);
    const latest = call.id === "erc-starting" ? deadline : subtractMonths(cutoff, 5 * 12);
    const within = phd >= earliest && phd <= latest;
    const detail = call.id === "erc-starting"
      ? `Defensa entre ${formatDate(earliest)} y la fecha límite, aplicando ${extensionMonths} meses declarados.`
      : `Defensa entre ${formatDate(earliest)} y ${formatDate(latest)}, aplicando ${extensionMonths} meses declarados al límite superior.`;
    checks.push(check(within ? "pass" : "block", "Ventana desde el doctorado", detail));
  }
  if (extension === null) checks.push(check("review", "Extensiones", "Indica 0 o los meses que puedan acreditarse."));
  checks.push(...evaluateBooleanSet(answers, [
    ["resubmissionClear", "Restricción de reenvío", "Debe comprobarse con el resultado de solicitudes ERC anteriores y el Work Programme 2027."],
    ["sameGrantNotHeld", "Límite de un grant del mismo tipo", "Desde 2027 no puede obtenerse dos veces el mismo esquema Starting o Consolidator."],
    ["hostEligible", "Institución anfitriona", "Debe ser elegible y asumir formalmente el compromiso de acogida."]
  ]));
  return checks;
}

function evaluateMsca(answers) {
  const checks = [];
  checks.push(booleanCheck(answers.phdComplete, "Doctorado en la fecha límite", "La defensa debe haberse completado antes del cierre."));
  const researchYears = optionalNumber(answers.researchYears);
  const excludedYears = optionalNumber(answers.excludedYears);
  if (researchYears === null || excludedYears === null) checks.push(check("review", "Experiencia investigadora", "Indica experiencia total y periodos excluibles; el máximo general es 8 años equivalentes."));
  else if (excludedYears > researchYears) checks.push(check("review", "Experiencia investigadora", "Los años excluibles no pueden superar la experiencia total declarada; revisa el cálculo."));
  else {
    const effective = Math.max(0, researchYears - excludedYears);
    checks.push(check(effective <= 8 ? "pass" : "block", "Experiencia investigadora", `${formatNumber(effective)} años computables tras restar ${formatNumber(excludedYears)} años declarados como excluibles; máximo general: 8.`));
  }
  const mobility = optionalNumber(answers.mobilityMonths);
  checks.push(mobility === null
    ? check("review", "Regla de movilidad", "Indica los meses de residencia o actividad principal en el país de destino durante los 36 meses previos.")
    : check(mobility <= 12 ? "pass" : "block", "Regla de movilidad", `${formatNumber(mobility)} meses declarados; no puede superar 12 de los 36 meses previos.`));
  if (!answers.fellowshipType) checks.push(check("review", "Modalidad", "Selecciona European o Global Fellowship."));
  if (answers.fellowshipType === "global") checks.push(booleanCheck(answers.globalStatus, "Nacionalidad o residencia para Global", "Global exige nacionalidad o residencia de larga duración de UE/país asociado."));
  if (!answers.previousSubmission || answers.previousSubmission === "unknown") checks.push(check("review", "Restricción de reenvío", "Confirma si hubo candidatura MSCA-PF en 2025."));
  else if (answers.previousSubmission === "no") checks.push(check("pass", "Restricción de reenvío", "No se declara candidatura en la edición anterior."));
  else {
    const score = optionalNumber(answers.previousScore);
    checks.push(score === null ? check("review", "Restricción de reenvío", "Indica la puntuación de 2025.") : check(score >= 80 ? "pass" : "block", "Restricción de reenvío", `Puntuación previa: ${formatNumber(score)} %; desde 2026, una puntuación inferior a 80 % impide reenviar.`));
  }
  checks.push(booleanCheck(answers.hostEligible, "Entidad anfitriona", "La entidad debe confirmar su elegibilidad y contratar a la persona investigadora."));
  return checks;
}

function evaluateGe(answers) {
  const checks = [minimumCheck(answers.doctorCount, 3, "Composición del grupo", "personas doctoras contando a la IP")];
  const phd = parseIsoDate(answers.phdDate);
  const extension = optionalNumber(answers.extensionYears);
  if (!phd || extension === null) checks.push(check("review", "Antigüedad del doctorado de la IP", "Indica fecha del primer doctorado y 0 o los años de ampliación documentables."));
  else {
    const earliest = subtractMonths(new Date(2016, 0, 1), extension * 12);
    checks.push(check(phd > earliest ? "pass" : "block", "Antigüedad del doctorado de la IP", `Debe ser posterior a ${formatDate(earliest)} con la ampliación declarada.`));
  }
  checks.push(...evaluateBooleanSet(answers, [
    ["allLinkedActive", "Doctorado, vinculación y servicio activo", "La condición afecta a todas las personas del grupo."],
    ["noFormerPi", "Sin experiencia previa como IP incompatible", "Ningún miembro puede haber sido IP de proyectos estatales o del Programa Marco."],
    ["noIncompatibilities", "Exclusividades del grupo", "Afectan a todas las personas, incluida la IP."]
  ]));
  return checks;
}

function evaluateAico(answers) {
  return [
    rangeCheck(answers.piCount, 1, 2, "Número de IP"),
    minimumCheck(answers.additionalDoctors, 3, "Composición adicional", "personas doctoras sin contar IP"),
    booleanCheck(answers.piMerit, "Trayectoria de cada IP", "2 sexenios, 2 proyectos elegibles como IP o un ERC finalizado."),
    routeCheck(answers.groupMeritRoute, "Media del grupo sin IP", "Debe elegirse y acreditarse una sola vía: sexenios o proyectos."),
    booleanCheck(answers.allLinkedActive, "Doctorado, vinculación y servicio activo", "La condición afecta a todas las personas."),
    booleanCheck(answers.noIncompatibilities, "Exclusividades del grupo", "Afectan a todas las personas, incluidas las IP.")
  ];
}

function evaluatePrometeo(answers) {
  return [
    rangeCheck(answers.piCount, 1, 2, "Número de IP"),
    minimumCheck(answers.additionalDoctors, 5, "Composición adicional", "personas doctoras sin contar IP"),
    booleanCheck(answers.piMerit, "Trayectoria de cada IP", "3 sexenios o 3 proyectos elegibles como IP."),
    routeCheck(answers.groupMeritRoute, "Media del grupo sin IP", "Debe acreditarse una media de 2 sexenios o 2 proyectos elegibles como IP."),
    booleanCheck(answers.allLinkedActive, "Doctorado, vinculación y servicio activo", "La condición afecta a todas las personas."),
    booleanCheck(answers.noIncompatibilities, "Exclusividades del grupo", "Afectan a todas las personas, incluidas las IP.")
  ];
}

function evaluateEic(answers) {
  const checks = [booleanCheck(answers.eligibleOrigin, "Proyecto de origen elegible", "Debe pertenecer a una de las familias admitidas en 2026.")];
  if (!answers.achievedTrl || answers.achievedTrl === "unknown") checks.push(check("review", "TRL alcanzado", "Debe demostrarse un TRL 3 completado o TRL 4."));
  else checks.push(check(["3", "4"].includes(answers.achievedTrl) ? "pass" : "block", "TRL alcanzado", `TRL declarado: ${answers.achievedTrl}; EIC Transition 2026 admite como punto de partida TRL 3 completado o TRL 4.`));
  checks.push(...evaluateBooleanSet(answers, [
    ["resultReported", "Resultado reportado", "Debe indicarse dónde se comunicó oficialmente el resultado."],
    ["rightsClear", "Propiedad o derechos de acceso", "El equipo necesita derechos suficientes para desarrollar y explotar el resultado."],
    ["eligibleComposition", "Composición de la propuesta", "Comprueba límites de entidad única o consorcio pequeño."]
  ]));
  checks.push(advisoryCheck(answers.techMarketTeam, "Capacidades tecnológicas y de mercado", "No es un umbral formal aislado, pero sí una condición operativa crítica."));
  return checks;
}

function evaluateCompany(answers) {
  const checks = [
    booleanCheck(answers.beneficiaryEligible, "Beneficiario directo", "Comprueba la ficha exacta del instrumento."),
    booleanCheck(answers.companyIdentified, "Empresa identificada", "Debe poder asumir obligaciones técnicas, financieras y de justificación.")
  ];
  if (!answers.uvRole || answers.uvRole === "unknown") checks.push(check("review", "Papel contractual de la UV", "Define si será beneficiaria, socia, subcontratada o parte de un contrato art. 60 LOSU."));
  else if (answers.uvRole === "advisor") checks.push(check("block", "Papel contractual de la UV", "El asesoramiento sin presupuesto ni instrumento contractual no cubre la ejecución de tareas financiadas."));
  else checks.push(check("pass", "Papel contractual de la UV", `Papel declarado: ${roleLabel(answers.uvRole)}; debe validarlo la unidad UV competente.`));
  checks.push(...evaluateBooleanSet(answers, [
    ["incentiveEffect", "Efecto incentivador", "En CDTI, la solicitud debe presentarse antes de comenzar los trabajos del proyecto."],
    ["noDoubleFunding", "Ausencia de doble financiación", "Los mismos costes no pueden imputarse dos veces."]
  ]));
  checks.push(advisoryCheck(answers.agreementReviewed, "Contrato, presupuesto y propiedad intelectual", "La UV debe revisar publicación, confidencialidad y explotación."));
  return checks;
}

function evaluateBooleanSet(answers, definitions) {
  return definitions.map(([id, label, detail]) => booleanCheck(answers[id], label, detail));
}

function booleanCheck(value, label, detail) {
  if (value === "yes") return check("pass", label, detail);
  if (value === "no") return check("block", label, detail);
  return check("review", label, detail);
}

function advisoryCheck(value, label, detail) {
  if (value === "yes") return check("pass", label, detail);
  return check("review", label, value === "no" ? `Pendiente de resolver. ${detail}` : detail);
}

function minimumCheck(value, minimum, label, unit) {
  const numeric = optionalNumber(value);
  return numeric === null ? check("review", label, `Indica el número de ${unit}.`) : check(numeric >= minimum ? "pass" : "block", label, `${formatNumber(numeric)} ${unit}; mínimo exigido: ${minimum}.`);
}

function rangeCheck(value, min, max, label) {
  const numeric = optionalNumber(value);
  return numeric === null ? check("review", label, `Indica un valor entre ${min} y ${max}.`) : check(numeric >= min && numeric <= max ? "pass" : "block", label, `Valor declarado: ${formatNumber(numeric)}; intervalo permitido: ${min}–${max}.`);
}

function routeCheck(value, label, detail) {
  if (value === "sexennia" || value === "projects") return check("pass", label, `${detail} Vía declarada: ${value === "sexennia" ? "sexenios" : "proyectos"}.`);
  if (value === "none") return check("block", label, detail);
  return check("review", label, detail);
}

function check(status, label, detail) {
  return { status, label, detail };
}

function buildMilestones(external, internal) {
  const items = [
    { date: subtractMonths(external, 6), title: "Go/no-go, encaje y protección de resultados", owner: "IP" },
    { date: subtractMonths(external, 3), title: "Cerrar equipo, host o consorcio y responsabilidades", owner: "IP / consorcio" },
    { date: addDays(external, -56), title: "Primer borrador completo y presupuesto v1", owner: "IP / equipo" },
    { date: addDays(external, -28), title: "Revisión científica externa y plan de impacto", owner: "Revisor/a" },
    { date: addDays(external, -14), title: "Ética, datos, género, IP y documentación institucional", owner: "IP / UV" },
    { date: addDays(external, -7), title: "Última semana: congelar contenido y validar portal", owner: "IP / UV" },
    { date: external, title: "Fecha límite externa y archivo del justificante", owner: "Representación / IP" }
  ];
  if (internal) items.push({ date: internal, title: "Cierre interno UV", owner: "IP / unidad UV" });
  return items.sort((a, b) => a.date - b.date || a.title.localeCompare(b.title, "es"));
}

function buildChecklist(call, eligibility) {
  const unresolved = eligibility.checks.filter((item) => item.status !== "pass").map((item) => ({ task: `${item.label}: ${item.detail}`, owner: "IP" }));
  const groups = [
    { title: "Elegibilidad y decisión", items: [
      ...(unresolved.length ? unresolved : [{ task: "Archivar evidencias de cada regla comprobada", owner: "IP" }]),
      { task: "Confirmar edición, fecha externa y cierre interno con la unidad UV", owner: "IP / UV" },
      { task: "Documentar la decisión go/no-go y la dedicación disponible", owner: "IP" }
    ] },
    { title: "Propuesta científica", items: [
      { task: "Redactar concepto de una página: problema, novedad, hipótesis y evidencia", owner: "IP" },
      { task: "Definir objetivos medibles, metodología, entregables e hitos", owner: "Equipo" },
      { task: "Preparar riesgos científicos y alternativas", owner: "Equipo" },
      { task: "Revisar ciencia abierta, gestión de datos, ética y dimensión de género", owner: "IP / UV" }
    ] },
    { title: "Presupuesto y administración", items: [
      { task: "Validar elegibilidad de personal, equipos, viajes, IVA e indirectos", owner: "IP / UV" },
      { task: "Recoger ofertas, costes de personal y justificación de recursos", owner: "Equipo / UV" },
      { task: "Cuadrar anualidades, financiación solicitada y aportación propia", owner: "IP / UV" }
    ] },
    { title: "Entrega y evidencia", items: [
      { task: "Completar formularios, CV, cartas y declaraciones", owner: "IP / equipo" },
      { task: "Solicitar revisiones y firmas institucionales con margen", owner: "IP / UV" },
      { task: "Validar la propuesta en el portal y archivar versión final, acuse y presupuesto", owner: "IP" }
    ] }
  ];
  if (call.participation === "consortium" || call.participation === "both") groups.splice(2, 0, { title: "Consorcio y acuerdos", items: [
    { task: "Cerrar socios, países, roles, tareas y presupuesto por entidad", owner: "Coordinación" },
    { task: "Acordar gobernanza, publicación, confidencialidad y propiedad de resultados", owner: "Consorcio / UV" },
    { task: "Comprobar identificadores, capacidad operativa y cartas de compromiso", owner: "Cada socio" }
  ] });
  if (call.purposes.includes("transfer") || call.purposes.includes("business")) groups.splice(-1, 0, { title: "Transferencia y explotación", items: [
    { task: "Inventariar resultados previos, titulares y restricciones de acceso", owner: "IP / transferencia UV" },
    { task: "Definir usuario, necesidad, competencia, regulación y vía de explotación", owner: "Equipo" },
    { task: "Acordar protección antes de cualquier divulgación", owner: "IP / transferencia UV" }
  ] });
  return groups;
}

function buildRisks(call, eligibility, internal) {
  const risks = [];
  if (eligibility.status === "block") risks.push("Existe al menos un bloqueo declarado: no invertir en la memoria hasta resolverlo o descartar la candidatura.");
  if (eligibility.status === "review") risks.push("Quedan reglas sin verificar: asigna responsable y evidencia a cada una antes del go/no-go.");
  if (!internal) risks.push("No se ha indicado cierre interno UV; la fecha externa no garantiza que la institución pueda firmar a tiempo.");
  if (call.participation === "consortium" || call.participation === "both") risks.push("Los cambios tardíos de socios afectan al presupuesto, las tareas, la elegibilidad y los acuerdos de propiedad intelectual.");
  if (call.purposes.includes("transfer") || call.purposes.includes("business")) risks.push("Divulgar antes de revisar titularidad y protección puede comprometer la explotación del resultado.");
  risks.push("Presupuesto, costes indirectos y límites deben recalcularse con los documentos de la edición abierta.");
  return risks;
}

function roleLabel(role) {
  return { beneficiary: "beneficiaria/socia", subcontractor: "subcontratada", article60: "contrato art. 60 LOSU" }[role] || role;
}

function statusMark(status) {
  return { pass: "✓", review: "?", block: "✕" }[status];
}

function milestoneState(state) {
  return { past: "fecha ya pasada", today: "hoy", upcoming: "pendiente" }[state];
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function requireIsoDate(value, message) {
  const date = parseIsoDate(value);
  if (!date) throw new Error(message);
  return date;
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha de referencia no es válida.");
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subtractMonths(value, months) {
  const date = normalizeDate(value);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() - months);
  date.setDate(Math.min(originalDay, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date;
}

function addDays(value, days) {
  const date = normalizeDate(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toIsoDate(value) {
  const date = normalizeDate(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDate(value) {
  const date = parseIsoDate(value);
  return date ? formatDate(date) : value;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function escapeIcs(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function foldIcsLine(line) {
  if (new TextEncoder().encode(line).length <= 75) return line;
  const parts = [];
  let current = "";
  for (const character of line) {
    const candidate = current + character;
    const limit = parts.length ? 74 : 75;
    if (new TextEncoder().encode(candidate).length > limit) {
      parts.push(current);
      current = character;
    } else current = candidate;
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
}
