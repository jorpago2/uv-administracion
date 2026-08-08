const POD_BASELINES = Object.freeze({
  0: { active: 230, inactive: 230 },
  1: { active: 220, inactive: 230 },
  2: { active: 210, inactive: 230 },
  3: { active: 180, inactive: 200 },
  4: { active: 170, inactive: 190 },
  5: { active: 160, inactive: 160 },
  6: { active: 160, inactive: 160 }
});

export function calculatePod(input) {
  const category = oneOf(input.category, ["cu", "permanent", "assistant_doctor"], "categoría POD");
  const course = oneOf(input.course, ["2026-27", "2027-28", "2028-29", "2029-30"], "curso");
  const sexennia = integer(input.sexennia, 0, 6, "sexenios");
  const active = Boolean(input.active);
  const inactiveYears = integer(input.inactiveYears ?? 0, 0, 30, "años sin sexenio activo");
  let baseline;
  let baselineRule;

  if (category === "assistant_doctor") {
    baseline = 180;
    baselineRule = "Profesorado Ayudante Doctor a tiempo completo: 180 horas.";
  } else if (sexennia === 3 && ["2026-27", "2027-28", "2028-29"].includes(course)) {
    baseline = active ? (category === "cu" ? 210 : 170) : 210;
    baselineRule = `Régimen transitorio para tres sexenios (${active ? "activo" : "no activo"}): ${baseline} horas.`;
  } else {
    const hasRecentInactivePeriod = !active && inactiveYears < 6;
    const status = active ? "active" : hasRecentInactivePeriod ? "inactive" : "active";
    baseline = POD_BASELINES[sexennia][status];
    if (!active && inactiveYears >= 6 && sexennia >= 1 && sexennia <= 4) baseline = 230;
    baselineRule = !active && inactiveYears >= 6 && sexennia >= 1 && sexennia <= 4
      ? "El sexenio no activo dejó de producir efecto tras seis cursos: 230 horas."
      : `Tabla general: ${sexennia} sexenio(s), ${active ? "activo" : "no activo dentro de los seis cursos"}: ${baseline} horas.`;
  }

  const projectCount = integer(input.publicProjects ?? 0, 0, 20, "proyectos públicos");
  const projectReduction = projectCount === 0 ? 0 : input.exceptionalEuropean ? 40 : [0, 10, 20, 30][Math.min(projectCount, 3)];
  const erasmusCount = integer(input.erasmusProjects ?? 0, 0, 20, "proyectos Erasmus+");
  const erasmusReduction = [0, 10, 20, 30][Math.min(erasmusCount, 3)];
  const thesisReduction = numberInRange(input.thesisHours ?? 0, 0, 60, "reducción por tesis");
  const otherReduction = numberInRange(input.otherHours ?? 0, 0, 300, "otras reducciones");
  const ageReduction = input.age63 && course === "2029-30" ? Math.min(10, Math.max(0, baseline - 160)) : 0;
  const reductions = { project: projectReduction, erasmus: erasmusReduction, theses: thesisReduction, age: ageReduction, other: otherReduction };
  const requestedReduction = Object.values(reductions).reduce((sum, value) => sum + value, 0);
  const theoretical = baseline - requestedReduction;
  const finalHours = Math.max(120, theoretical);
  const warnings = [];
  if (projectReduction || erasmusReduction) warnings.push("Las reducciones por proyectos dependen de su reconocimiento en POD y pueden limitarse si el área tiene superávit estructural.");
  if (theoretical < 120) warnings.push("Se aplica el mínimo general de 120 horas después de reducciones.");
  if (input.age63 && course !== "2029-30") warnings.push("La reducción por edad comienza en 2029-30; no se aplica en el curso seleccionado.");
  if (input.age63 && course === "2029-30" && ageReduction === 0) warnings.push("La reducción por edad no puede llevar la dedicación base por debajo de 160 horas.");
  if (category === "assistant_doctor" && sexennia) warnings.push("Los sexenios no modifican la base específica de Ayudante Doctor en este estimador.");

  return { baseline, baselineRule, reductions, requestedReduction, theoretical, finalHours, warnings };
}

export function classifyPurchase(input) {
  const type = oneOf(input.type, ["supplies", "services", "works", "research", "database"], "tipo de compra");
  const amount = numberInRange(input.amount, 0, 100_000_000, "importe sin IVA");
  const durationMonths = integer(input.durationMonths, 1, 240, "duración");
  const warnings = [];
  const steps = [];
  const minorLimit = type === "works" ? 40_000 : type === "research" ? 50_000 : type === "database" ? null : 15_000;
  const thresholdAllowsMinor = type === "database" || (type === "research" ? amount <= minorLimit : amount < minorLimit);

  if (input.framework) {
    return purchaseResult("derived", "Compra derivada de acuerdo marco", amount, 0, false,
      ["Identifica el acuerdo marco o sistema dinámico aplicable.", "Tramita la compra por su procedimiento derivado; no como contrato menor."],
      ["La instrucción de contratos menores no es la vía aplicable."], minorLimit);
  }
  if (input.recurring || durationMonths > 12 || !thresholdAllowsMinor) {
    if (input.recurring) warnings.push("Una necesidad recurrente y previsible no debe encadenarse mediante contratos menores.");
    if (durationMonths > 12) warnings.push("El contrato menor no puede superar un año ni prorrogarse.");
    if (!thresholdAllowsMinor) warnings.push(`El importe no cumple el límite de contrato menor${minorLimit ? ` (${formatPlain(minorLimit)} € sin IVA)` : " aplicable"}.`);
    steps.push("No comprometas el gasto.", "Consulta a la unidad gestora y al Servei de Contractació Administrativa para elegir el procedimiento.");
    return purchaseResult("not-minor", "No tramitar como contrato menor", amount, 0, false, steps, warnings, minorLimit);
  }

  if (type === "database") warnings.push("El límite superior de bases de datos y suscripciones depende del umbral SARA vigente: debe comprobarlo la unidad gestora.");
  if (amount < 5_000) {
    steps.push(
      ...(amount > 200 ? ["Antes de comprometer el gasto, remite a la unidad gestora el formulario inicial o presupuesto."] : []),
      type === "works" ? "Obtén al menos un presupuesto antes de encargar la obra." : "Conserva la oferta o pedido y la justificación de la necesidad.",
      "Encarga la prestación y presenta la factura con los datos y conformidad exigibles."
    );
    if (input.periodicOrForeign) warnings.push("Aunque sea inferior a 5.000 €, el AD es necesario para facturas periódicas o pagos al extranjero.");
    return purchaseResult("small-expense", "Contrato menor inferior a 5.000 €", amount, type === "works" ? 1 : 0, Boolean(input.periodicOrForeign), steps, warnings, minorLimit);
  }

  const requiresThree = (type === "works" && amount >= 30_000)
    || (["supplies", "services", "research"].includes(type) && amount >= 6_000)
    || (type === "database" && amount >= 30_000);
  const offers = requiresThree && !input.exclusive ? 3 : 1;
  if (requiresThree && input.exclusive) warnings.push("La exclusividad solo sustituye las tres ofertas si está objetivamente justificada y se incorpora informe de exclusividad.");
  steps.push(
    `Reúne ${offers === 3 ? "al menos tres ofertas comparables" : "la oferta y la justificación de la necesidad"}${input.exclusive && requiresThree ? ", junto con el informe de exclusividad" : ""}.`,
    "Inicia el expediente en UV-plyca antes de realizar el pedido.",
    "Espera la resolución de adjudicación y la contabilización AD antes de encargar la prestación.",
    "Tras la prestación, conforma y tramita la factura."
  );
  const status = type === "database" ? "verify-threshold" : "minor";
  const title = type === "database" ? "Posible contrato menor: verifica el umbral SARA" : "Contrato menor: tramitación previa";
  return purchaseResult(status, title, amount, offers, true, steps, warnings, minorLimit);
}

export function calculateTravel(input, data) {
  validateTravelData(data);
  const funding = oneOf(input.funding, ["uv", "age-gva"], "régimen de financiación");
  if (funding !== "uv") {
    return {
      applicable: false,
      warnings: ["Este estimador aplica el régimen propio UV. En ayudas AGE o GVA pueden regir cuantías y condiciones distintas: consulta la convocatoria y la unidad gestora."],
      breakdown: {}, total: null
    };
  }
  const destinationType = oneOf(input.destinationType, ["madrid-barcelona", "rest-spain", "foreign"], "destino");
  const lodgingDays = integer(input.lodgingDays ?? 0, 0, 365, "noches");
  const fullMealDays = numberInRange(input.fullMealDays ?? 0, 0, 365, "dietas completas");
  const halfMealDays = numberInRange(input.halfMealDays ?? 0, 0, 365, "medias dietas");
  const actualLodging = numberInRange(input.actualLodging ?? 0, 0, 1_000_000, "alojamiento real");
  const publicTransport = numberInRange(input.publicTransport ?? 0, 0, 1_000_000, "transporte público");
  const registration = numberInRange(input.registration ?? 0, 0, 1_000_000, "inscripción");
  const kilometres = numberInRange(input.kilometres ?? 0, 0, 100_000, "kilómetros");
  const vehicle = oneOf(input.vehicle ?? "car", ["car", "motorcycle"], "vehículo");
  const distance = numberInRange(input.distance ?? 0, 0, 100_000, "distancia");
  let lodgingRate;
  let mealRate;
  let destinationLabel;

  if (destinationType === "foreign") {
    const destination = data.foreign.find((item) => item.id === input.foreignId);
    if (!destination) throw new RangeError("Selecciona un destino extranjero válido.");
    lodgingRate = destination.lodging;
    mealRate = destination.meals;
    destinationLabel = destination.label;
  } else {
    lodgingRate = destinationType === "madrid-barcelona" ? data.domestic.madridBarcelonaLodging : data.domestic.restSpainLodging;
    mealRate = data.domestic.meals;
    destinationLabel = destinationType === "madrid-barcelona" ? "Madrid o Barcelona" : "Resto de España";
  }

  const lodgingCap = lodgingRate * lodgingDays;
  const eligibleLodging = Math.min(actualLodging, lodgingCap);
  const mealsRequested = mealRate * (fullMealDays + halfMealDays * 0.5);
  const mealsEligible = distance > 30 && Boolean(input.exceedsWorkday) ? mealsRequested : 0;
  const mileage = kilometres * data.mileage[vehicle];
  const breakdown = {
    lodging: roundMoney(eligibleLodging), meals: roundMoney(mealsEligible), mileage: roundMoney(mileage),
    publicTransport: roundMoney(publicTransport), registration: roundMoney(registration)
  };
  const total = roundMoney(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const warnings = [];
  if (actualLodging > lodgingCap) warnings.push(`El alojamiento supera el máximo de ${formatPlain(lodgingCap)} € para ${lodgingDays} noche(s); el exceso no se incluye.`);
  if (mealsRequested && distance <= 30) warnings.push("A 30 km o menos no corresponde manutención, aunque pueden abonarse gastos de viaje justificados.");
  if (mealsRequested && distance > 30 && !input.exceedsWorkday) warnings.push("La manutención a más de 30 km exige que el servicio obligue a exceder la jornada ordinaria y autorización motivada.");
  if (kilometres) warnings.push("Comprueba que los kilómetros corresponden al trayecto más corto desde residencia o puesto de trabajo.");
  warnings.push("La inscripción se suma como coste planificado, pero no es una dieta; debe ser elegible y justificarse por su vía propia.");
  return { applicable: true, destinationLabel, lodgingRate, mealRate, lodgingCap: roundMoney(lodgingCap), breakdown, total, warnings };
}

export function estimatePersonnelCost(input) {
  const grossAnnual = numberInRange(input.grossAnnual, 0, 10_000_000, "salario bruto anual");
  const months = numberInRange(input.months, 0.1, 120, "meses");
  const contractType = oneOf(input.contractType, ["indefinite", "fixed"], "tipo de contrato");
  const accidentRate = numberInRange(input.accidentRate, 0, 20, "tipo de accidentes");
  const otherRate = numberInRange(input.otherRate ?? 0, 0, 50, "otros porcentajes");
  const otherCosts = numberInRange(input.otherCosts ?? 0, 0, 10_000_000, "otros costes");
  const reserveRate = numberInRange(input.reserveRate ?? 0, 0, 50, "reserva");
  const salary = grossAnnual * months / 12;
  const rates = {
    common: 23.6,
    unemployment: contractType === "indefinite" ? 5.5 : 6.7,
    fogasa: 0.2,
    training: 0.6,
    mei: 0.75,
    accidents: accidentRate,
    other: otherRate
  };
  const contributions = Object.fromEntries(Object.entries(rates).map(([key, rate]) => [key, roundMoney(salary * rate / 100)]));
  const contributionTotal = roundMoney(Object.values(contributions).reduce((sum, value) => sum + value, 0));
  const subtotal = salary + contributionTotal + otherCosts;
  const reserve = roundMoney(subtotal * reserveRate / 100);
  const total = roundMoney(subtotal + reserve);
  return {
    salary: roundMoney(salary), rates, contributions, contributionTotal, otherCosts: roundMoney(otherCosts), reserve,
    total, monthlyAverage: roundMoney(total / months),
    warnings: [
      "Estimación presupuestaria: topes y bases de cotización, bonificaciones, tarifa exacta de accidentes, indemnizaciones y reglas de la convocatoria pueden cambiar el coste real.",
      "Confirma el coste definitivo y la elegibilidad con la unidad gestora antes de publicar o formalizar el contrato."
    ]
  };
}

export function validateTravelData(data) {
  if (!data || data.schemaVersion !== 1 || !data.mileage || !data.domestic || !Array.isArray(data.foreign)) throw new Error("La tabla de dietas no tiene el formato esperado.");
  if (data.foreign.length < 90) throw new Error("La tabla de destinos extranjeros está incompleta.");
  return data;
}

function purchaseResult(status, title, amount, offers, requiresAd, steps, warnings, minorLimit) {
  return { status, title, amount, offers, requiresAd, steps, warnings, minorLimit };
}

function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new RangeError(`Valor no válido para ${label}.`);
  return value;
}

function numberInRange(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new RangeError(`${label} debe estar entre ${min} y ${max}.`);
  return number;
}

function integer(value, min, max, label) {
  const number = numberInRange(value, min, max, label);
  if (!Number.isInteger(number)) throw new RangeError(`${label} debe ser un número entero.`);
  return number;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatPlain(value) {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
