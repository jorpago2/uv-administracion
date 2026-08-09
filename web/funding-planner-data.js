export const ELIGIBILITY_OPTIONS = Object.freeze([
  ["", "Selecciona una respuesta"],
  ["yes", "Sí"],
  ["no", "No"],
  ["unknown", "Todavía no lo sé"]
]);

const yesNo = (id, label, help = "") => ({ id, type: "select", label, help, options: ELIGIBILITY_OPTIONS });
const number = (id, label, min, max, help = "") => ({ id, type: "number", label, min, max, step: 1, help });
const date = (id, label, help = "") => ({ id, type: "date", label, help });
const select = (id, label, options, help = "") => ({ id, type: "select", label, options, help });

export const FUNDING_RULE_PACKAGES = Object.freeze([
  {
    id: "erc-career-2027",
    callIds: ["erc-starting", "erc-consolidator"],
    title: "Ventana ERC y restricciones personales",
    editionReference: "ERC Work Programme 2027",
    verifiedOn: "2026-08-09",
    source: {
      label: "ERC · reglas de candidatura 2027",
      url: "https://erc.europa.eu/news-events/news/applying-erc-grant-2027-competitions-what-you-need-know"
    },
    caveat: "La herramienta calcula la ventana general de 2027. Las extensiones deben estar documentadas y las restricciones de reenvío se confirman en el Work Programme.",
    questions: [
      date("phdDate", "Fecha de defensa del primer doctorado", "ERC toma como referencia la defensa, no la expedición del título."),
      number("extensionMonths", "Extensión documentable de la ventana · meses", 0, 240, "Introduce 0 si no aplica. No presupone que ERC vaya a aceptar la causa."),
      yesNo("resubmissionClear", "¿Has comprobado que no te afecta una restricción de reenvío?"),
      yesNo("sameGrantNotHeld", "¿Confirmas que nunca has obtenido antes este mismo tipo de grant?", "Desde 2027 solo puede obtenerse una Starting y una Consolidator a lo largo de la carrera."),
      yesNo("hostEligible", "¿La institución anfitriona está en la UE o en un país asociado y acepta la candidatura?")
    ]
  },
  {
    id: "msca-pf-2026",
    callIds: ["msca-pf"],
    title: "Movilidad y experiencia MSCA-PF",
    editionReference: "MSCA Postdoctoral Fellowships 2026",
    verifiedOn: "2026-08-09",
    source: {
      label: "Comisión Europea · MSCA Postdoctoral Fellowships",
      url: "https://marie-sklodowska-curie-actions.ec.europa.eu/actions/postdoctoral-fellowships"
    },
    caveat: "La experiencia excluible y la residencia de larga duración requieren evidencias. El resultado no sustituye el cálculo oficial.",
    questions: [
      select("fellowshipType", "Modalidad", [["", "Selecciona modalidad"], ["european", "European Fellowship"], ["global", "Global Fellowship"]]),
      yesNo("phdComplete", "¿Tendrá el doctorado defendido en la fecha límite?"),
      { ...number("researchYears", "Años de experiencia investigadora desde el doctorado", 0, 60, "Puede introducir decimales."), step: 0.1 },
      { ...number("excludedYears", "Años excluibles documentables", 0, 60, "Interrupciones, trabajo fuera de investigación u otras exclusiones admitidas; deben justificarse."), step: 0.1 },
      number("mobilityMonths", "Meses en el país de destino durante los 36 meses previos", 0, 36),
      yesNo("globalStatus", "Para Global: ¿es nacional o residente de larga duración de UE/país asociado?"),
      select("previousSubmission", "¿Presentó una MSCA-PF en 2025?", [["", "Selecciona una respuesta"], ["no", "No"], ["yes", "Sí"], ["unknown", "No lo sé"]]),
      number("previousScore", "Si la presentó: puntuación obtenida · %", 0, 100),
      yesNo("hostEligible", "¿La entidad anfitriona confirma que puede ser beneficiaria?")
    ]
  },
  {
    id: "gva-ge-2026",
    callIds: ["gva-ge"],
    title: "Grupo emergente GE 2026",
    editionReference: "Convocatoria GVA 2026",
    verifiedOn: "2026-08-09",
    source: {
      label: "Sede GVA · grupos emergentes GE",
      url: "https://sede.gva.es/es/detall-tramit?id_proc=G104733"
    },
    caveat: "La fecha de doctorado admite determinadas ampliaciones. La UV debe validar vinculación, servicio activo e incompatibilidades de todas las personas.",
    questions: [
      number("doctorCount", "Personas doctoras del grupo, incluida la IP", 0, 100),
      date("phdDate", "Fecha del primer doctorado de la IP"),
      number("extensionYears", "Ampliación documentable de la fecha de doctorado · años", 0, 20),
      yesNo("allLinkedActive", "¿Todas son doctoras, están vinculadas a un centro y en servicio activo?"),
      yesNo("noFormerPi", "¿Ninguna persona ha sido IP de un proyecto estatal o del Programa Marco?"),
      yesNo("noIncompatibilities", "¿Ninguna persona integra otro grupo GVA incompatible, otra solicitud GE o un contrato Plan GenT?")
    ]
  },
  {
    id: "gva-aico-2025",
    callIds: ["gva-aico"],
    title: "Grupo consolidado AICO",
    editionReference: "Convocatoria GVA 2025",
    verifiedOn: "2026-08-09",
    source: {
      label: "Sede GVA · grupos consolidados AICO",
      url: "https://sede.gva.es/es/detall-tramit?id_proc=17234"
    },
    caveat: "Los umbrales corresponden a la edición 2025. Hay que revalidarlos cuando se publique una nueva convocatoria.",
    questions: [
      number("piCount", "Número de IP", 0, 10),
      number("additionalDoctors", "Personas doctoras adicionales, sin contar IP", 0, 100),
      yesNo("piMerit", "¿Cada IP acredita 2 sexenios, 2 proyectos elegibles como IP o un ERC finalizado?"),
      select("groupMeritRoute", "Vía elegida para la media del grupo sin IP", [["", "Selecciona una vía"], ["sexennia", "Media de 1 sexenio"], ["projects", "Media de 1 proyecto elegible como IP"], ["none", "No alcanza ninguna"], ["unknown", "Pendiente de calcular"]]),
      yesNo("allLinkedActive", "¿Todas las personas son doctoras, están vinculadas y en servicio activo?"),
      yesNo("noIncompatibilities", "¿Ninguna persona integra otro grupo GVA incompatible, otra solicitud AICO o un contrato Plan GenT?")
    ]
  },
  {
    id: "gva-prometeo-2025",
    callIds: ["gva-prometeo"],
    title: "Grupo de excelencia PROMETEO",
    editionReference: "Convocatoria GVA 2025",
    verifiedOn: "2026-08-09",
    source: {
      label: "Sede GVA · Programa PROMETEO",
      url: "https://sede.gva.es/es/detall-tramit?id_proc=16376"
    },
    caveat: "Los umbrales corresponden a la edición 2025. Las equivalencias y autorizaciones deben quedar documentadas.",
    questions: [
      number("piCount", "Número de IP", 0, 10),
      number("additionalDoctors", "Personas doctoras adicionales, sin contar IP", 0, 100),
      yesNo("piMerit", "¿Cada IP acredita 3 sexenios o 3 proyectos elegibles como IP?"),
      select("groupMeritRoute", "Vía elegida para la media del grupo sin IP", [["", "Selecciona una vía"], ["sexennia", "Media de 2 sexenios"], ["projects", "Media de 2 proyectos elegibles como IP"], ["none", "No alcanza ninguna"], ["unknown", "Pendiente de calcular"]]),
      yesNo("allLinkedActive", "¿Todas las personas son doctoras, están vinculadas y en servicio activo?"),
      yesNo("noIncompatibilities", "¿Ninguna persona integra otro PROMETEO/grupo GVA incompatible o un contrato Plan GenT?")
    ]
  },
  {
    id: "aei-pdc-2025",
    callIds: ["aei-pdc"],
    title: "Proyecto y resultado de origen PDC",
    editionReference: "Proyectos de Prueba de Concepto 2025",
    verifiedOn: "2026-08-09",
    source: {
      label: "AEI · Proyectos de Prueba de Concepto 2025",
      url: "https://www.aei.gob.es/convocatorias/buscador-convocatorias/proyectos-prueba-concepto-2025"
    },
    caveat: "La edición determina qué convocatorias y anualidades de origen son elegibles. Identifica el expediente exacto antes de decidir.",
    questions: [
      yesNo("eligibleOrigin", "¿El proyecto de origen aparece entre las convocatorias y anualidades elegibles?"),
      yesNo("linkedResult", "¿El resultado a valorizar fue generado en ese proyecto y puede trazarse?"),
      yesNo("sameExecutionForm", "¿Se mantiene la forma individual/coordinada exigida respecto al proyecto de origen?"),
      yesNo("valorisationNotContinuation", "¿El plan es de valorización/desarrollo precompetitivo y no mera continuación de investigación?"),
      yesNo("rightsClear", "¿La UV ha revisado titularidad, protección y derechos de explotación del resultado?")
    ]
  },
  {
    id: "eic-transition-2026",
    callIds: ["eic-transition"],
    title: "Resultado de origen y TRL EIC Transition",
    editionReference: "EIC Work Programme 2026",
    verifiedOn: "2026-08-09",
    source: {
      label: "Comisión Europea · EIC Transition 2026",
      url: "https://eic.ec.europa.eu/eic-funding-opportunities/eic-transition_en"
    },
    caveat: "La lista publicada de proyectos elegibles es indicativa, no prueba definitiva. Deben documentarse el resultado y el TRL alcanzado.",
    questions: [
      yesNo("eligibleOrigin", "¿El resultado procede de un tipo de proyecto admitido en EIC Transition 2026?"),
      select("achievedTrl", "TRL plenamente alcanzado del resultado al presentar", [["", "Selecciona TRL"], ["1", "TRL 1"], ["2", "TRL 2"], ["3", "TRL 3"], ["4", "TRL 4"], ["5", "TRL 5 o superior"], ["unknown", "Pendiente de documentar"]]),
      yesNo("resultReported", "¿Puede indicarse dónde se reportó oficialmente el resultado?"),
      yesNo("rightsClear", "¿El consorcio dispone de propiedad o derechos de acceso suficientes?"),
      yesNo("eligibleComposition", "¿La composición elegida —entidad única o consorcio— cumple los límites de la convocatoria?"),
      yesNo("techMarketTeam", "¿El equipo cubre desarrollo tecnológico, usuario/mercado y explotación?")
    ]
  },
  {
    id: "company-led",
    callIds: ["cdti-id", "ivace-innovacion", "aei-cpp", "articulo-60"],
    title: "Beneficiario empresarial y papel contractual UV",
    editionReference: "Condiciones del instrumento y procedimientos UV vigentes",
    verifiedOn: "2026-08-09",
    source: {
      label: "CDTI · Proyectos de I+D",
      url: "https://www.cdti.es/ayudas/proyectos-de-i-d"
    },
    caveat: "No todas estas vías tienen idéntico beneficiario. El contrato, la ayuda y la convocatoria concreta deben revisarse con el servicio UV competente.",
    questions: [
      yesNo("beneficiaryEligible", "¿La entidad que recibirá directamente la ayuda es elegible en el instrumento concreto?"),
      yesNo("companyIdentified", "¿Existe una empresa con capacidad técnica y financiera identificada?"),
      select("uvRole", "Papel previsto para la UV", [["", "Selecciona el papel"], ["beneficiary", "Beneficiaria/socia"], ["subcontractor", "Subcontratada"], ["article60", "Contrato art. 60 LOSU"], ["advisor", "Asesoramiento sin presupuesto"], ["unknown", "Pendiente de definir"]]),
      yesNo("incentiveEffect", "¿No se han iniciado los trabajos que comprometerían el efecto incentivador?"),
      yesNo("agreementReviewed", "¿Se prevé revisión UV de presupuesto, propiedad intelectual, publicación y confidencialidad?"),
      yesNo("noDoubleFunding", "¿Se ha descartado doble financiación de los mismos costes?")
    ]
  }
]);

export const GENERIC_RULE_PACKAGE = Object.freeze({
  id: "generic",
  callIds: [],
  title: "Precomprobación general",
  editionReference: "Debe revisarse la edición abierta",
  verifiedOn: "2026-08-09",
  source: null,
  caveat: "Esta vía no tiene todavía un comprobador específico. El resultado solo detecta bloqueos generales y siempre exige validación institucional.",
  questions: [
    yesNo("beneficiaryEligible", "¿La UV o la persona solicitante encaja como beneficiaria elegible?"),
    yesNo("piEligible", "¿La persona propuesta cumple los requisitos de IP o participante?"),
    yesNo("compositionEligible", "¿La composición individual, institucional o de consorcio es admisible?"),
    yesNo("topicFit", "¿La idea responde al alcance y a los resultados esperados de la convocatoria?"),
    yesNo("resourcesAvailable", "¿Hay tiempo, cofinanciación y recursos para ejecutar la propuesta?"),
    yesNo("internalDeadlineConfirmed", "¿Se ha confirmado el cierre interno con la unidad UV competente?")
  ]
});

export const BUDGET_PRESETS = Object.freeze({
  "erc-starting": { years: 5, fundingRate: 100, indirectRate: 25, grantCeiling: 1500000 },
  "erc-consolidator": { years: 5, fundingRate: 100, indirectRate: 25, grantCeiling: 2000000 },
  "eic-transition": { years: 3, fundingRate: 100, indirectRate: 25, grantCeiling: 2500000 },
  "aei-pdc": { years: 2, fundingRate: 100, indirectRate: 21, grantCeiling: 300000 }
});

export function getRulePackage(callId) {
  return FUNDING_RULE_PACKAGES.find((item) => item.callIds.includes(callId)) || GENERIC_RULE_PACKAGE;
}
