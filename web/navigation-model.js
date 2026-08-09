export const NAV_LANDMARKS = Object.freeze([
  landmark("inicio", "Inicio", { shortcut: true, typeLabel: "Portada" }),
  landmark("situaciones", "50 situaciones", { shortcut: true, typeLabel: "Resolución" }),
  landmark("glosario", "Glosario PDI", { shortcut: true, typeLabel: "Consulta" }),
  landmark("tareas-frecuentes", "Tareas frecuentes", { shortcut: true, typeLabel: "Accesos directos" }),
  landmark("ambitos", "Ámbitos de trabajo", { shortcut: true, typeLabel: "Exploración" }),
  landmark("herramientas-operativas", "Herramientas operativas", { shortcut: true, typeLabel: "Herramientas" }),
  landmark("asistente-tramites", "Asistente de procedimientos", { parentId: "herramientas-operativas", categoryId: "planificacion", typeLabel: "Herramienta" }),
  landmark("fichas-procedimiento", "Fichas de procedimientos", { parentId: "herramientas-operativas", categoryId: "planificacion", typeLabel: "Herramienta" }),
  landmark("calendario-anual", "Calendario anual", { parentId: "herramientas-operativas", categoryId: "planificacion", typeLabel: "Herramienta" }),
  landmark("explorador-financiacion", "Financiación I+D+i", { shortcut: true, categoryId: "investigacion", typeLabel: "Investigación" }),
  landmark("preparador-candidatura", "Preparador de candidatura", { parentId: "explorador-financiacion", categoryId: "investigacion", typeLabel: "Herramienta" }),
  landmark("calculadoras-operativas", "Calculadoras", { shortcut: true, typeLabel: "Herramientas" }),
  landmark("calculadora-pod", "Calculadora de POD", { parentId: "calculadoras-operativas", categoryId: "docencia", typeLabel: "Calculadora" }),
  landmark("calculadora-compras", "Tramitación de compras", { parentId: "calculadoras-operativas", categoryId: "gestion", typeLabel: "Calculadora" }),
  landmark("calculadora-viajes", "Planificación de viajes", { parentId: "calculadoras-operativas", categoryId: "gestion", typeLabel: "Calculadora" }),
  landmark("calculadora-personal", "Coste de personal", { parentId: "calculadoras-operativas", categoryId: "investigacion", typeLabel: "Calculadora" }),
  landmark("calculadora-presupuesto", "Presupuesto de proyecto", { parentId: "calculadoras-operativas", categoryId: "investigacion", typeLabel: "Calculadora" }),
  landmark("casos-completos", "Casos completos", { parentId: "calculadoras-operativas", typeLabel: "Ejemplos" }),
  landmark("calculadora-retributiva", "Calculadora de salario", { parentId: "calculadoras-operativas", categoryId: "pdi", typeLabel: "Calculadora" }),
  landmark("indice-capitulos", "Manual completo", { shortcut: true, typeLabel: "Manual" })
]);

export function pickCurrentNavigationItem(items, probeLine) {
  const candidates = items
    .filter((item) => !item.hidden && Number.isFinite(item.top))
    .sort((left, right) => left.top - right.top || left.order - right.order);
  if (!candidates.length) return null;
  return candidates.reduce((current, item) => item.top <= probeLine ? item : current, candidates[0]);
}

function landmark(id, label, options = {}) {
  return Object.freeze({ id, label, shortcut: false, parentId: id, categoryId: null, typeLabel: "Sección", ...options });
}
