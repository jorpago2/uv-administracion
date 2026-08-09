export const CATEGORIES = Object.freeze([
  category({
    id: "planificacion",
    label: "Orientación, administración y gobierno",
    shortLabel: "Administración y gobierno",
    summary: "Empieza, identifica la unidad competente y conserva una trazabilidad documental útil.",
    sections: [1, 2, 3, 4, 5, 6, 7],
    featuredSections: [2, 5, 6],
    tools: [
      ["Resolver un trámite", "#asistente-tramites"],
      ["Consultar fichas", "#fichas-procedimiento"],
      ["Crear calendario", "#calendario-anual"]
    ]
  }),
  category({
    id: "docencia",
    label: "Docencia",
    shortLabel: "Docencia",
    summary: "Organiza POD, evaluación, trabajos finales, prácticas, tutorías, movilidad y doctorado.",
    sections: [8, 9, 10, 11, 12, 13, 14, 15],
    featuredSections: [8, 9, 10],
    tools: [
      ["Calcular POD", "#calculadora-pod"],
      ["Buscar un procedimiento docente", "#asistente-tramites"],
      ["Consultar calendario", "#calendario-anual"]
    ]
  }),
  category({
    id: "pdi",
    label: "Carrera y condiciones PDI",
    shortLabel: "Carrera PDI",
    summary: "Consulta permisos, acreditación, promoción, retribuciones y cambios de situación profesional.",
    sections: [16, 17, 18, 19],
    featuredSections: [16, 17, 18],
    tools: [
      ["Calcular salario bruto", "#calculadora-retributiva"],
      ["Revisar dedicación POD", "#calculadora-pod"],
      ["Resolver un trámite PDI", "#asistente-tramites"]
    ]
  }),
  category({
    id: "investigacion",
    label: "Investigación y transferencia",
    shortLabel: "Investigación",
    summary: "Localiza financiación y prepara, ejecuta, contrata, protege y transfiere resultados.",
    sections: [20, 21, 22, 23, 24, 25, 26, 27, 28],
    featuredSections: [20, 21, 22],
    tools: [
      ["Explorar financiación", "#explorador-financiacion"],
      ["Preparar candidatura", "#preparador-candidatura"],
      ["Presupuestar un proyecto", "#calculadora-presupuesto"],
      ["Calcular coste de personal", "#calculadora-personal"]
    ]
  }),
  category({
    id: "gestion",
    label: "Gestión administrativa y económica",
    shortLabel: "Gestión económica",
    summary: "Decide cómo tramitar compras, viajes, presupuestos y gastos antes de comprometerlos.",
    sections: [29, 30],
    featuredSections: [29, 30],
    tools: [
      ["Elegir tramitación de compra", "#calculadora-compras"],
      ["Planificar un viaje", "#calculadora-viajes"],
      ["Preparar presupuesto", "#calculadora-presupuesto"],
      ["Consultar fichas", "#fichas-procedimiento"]
    ]
  }),
  category({
    id: "cumplimiento",
    label: "Cumplimiento, seguridad y derechos",
    shortLabel: "Derechos y cumplimiento",
    summary: "Actúa ante riesgos, datos, ética, igualdad, conflictos, recursos, quejas y denuncias.",
    sections: [31, 32, 33, 34, 35, 36, 37],
    featuredSections: [31, 32, 36],
    tools: [
      ["Resolver una incidencia", "#asistente-tramites"],
      ["Consultar fichas", "#fichas-procedimiento"],
      ["Ver alertas", "ALERTAS.md"]
    ]
  })
]);

function category(definition) {
  return Object.freeze({
    ...definition,
    sections: Object.freeze(definition.sections),
    featuredSections: Object.freeze(definition.featuredSections),
    tools: Object.freeze(definition.tools.map(([label, href]) => Object.freeze({ label, href })))
  });
}
