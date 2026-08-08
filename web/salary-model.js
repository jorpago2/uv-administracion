const MONEY_PRECISION = 100;

export function calculateSalary(data, selection) {
  validateSalaryData(data);
  const category = data.categories.find((item) => item.id === selection.categoryId);
  if (!category) throw new Error("La categoría seleccionada no existe.");

  const profile = category.dedications.find((item) => item.id === selection.dedicationId);
  if (!profile) throw new Error("La dedicación seleccionada no existe para esta categoría.");

  const role = data.academicRoles.find((item) => item.id === selection.roleId) ?? data.academicRoles[0];
  const triennia = toNonNegativeInteger(selection.triennia);
  const teachingPeriods = toNonNegativeInteger(selection.teachingPeriods);
  const researchPeriods = toNonNegativeInteger(selection.researchPeriods);
  const otherAutonomic = toNonNegativeMoney(selection.otherAutonomic);

  const isFunctionary = profile.mode === "functionary";
  const salary = isFunctionary
    ? profile.salaryMonthly * 12 + profile.salaryExtra * 2
    : profile.salaryMonthly * data.paymentCount;
  const destination = profile.destinationMonthly * data.paymentCount;
  const specific = profile.specificMonthly * data.paymentCount;
  const trienniumUnit = isFunctionary
    ? profile.trienniumMonthly * 12 + profile.trienniumExtra * 2
    : profile.trienniumMonthly * data.paymentCount;
  const teachingUnit = profile.teachingPeriodMonthly * data.paymentCount;
  const researchUnit = profile.researchPeriodMonthly * data.paymentCount;
  const autonomic = selection.includeAutonomic && category.autonomicEligible
    ? getAutonomicAnnual(data.autonomicTiers, teachingPeriods + researchPeriods)
    : 0;

  const breakdown = {
    salary: roundMoney(salary),
    destination: roundMoney(destination),
    specific: roundMoney(specific),
    triennia: roundMoney(trienniumUnit * triennia),
    teachingPeriods: roundMoney(teachingUnit * teachingPeriods),
    researchPeriods: roundMoney(researchUnit * researchPeriods),
    autonomic: roundMoney(autonomic),
    otherAutonomic: roundMoney(otherAutonomic),
    academicRole: roundMoney(role.annual)
  };
  const annual = roundMoney(Object.values(breakdown).reduce((sum, amount) => sum + amount, 0));
  const autonomicCap = roundMoney((breakdown.salary + breakdown.destination) * 0.4);

  return {
    category,
    profile,
    role,
    breakdown,
    annual,
    perPayment: roundMoney(annual / data.paymentCount),
    autonomicCap,
    exceedsAutonomicCap: breakdown.autonomic + breakdown.otherAutonomic > autonomicCap,
    unavailableTeachingPeriods: teachingPeriods > 0 && teachingUnit === 0,
    unavailableResearchPeriods: researchPeriods > 0 && researchUnit === 0
  };
}

export function getAutonomicAnnual(tiers, recognizedPeriods) {
  const count = toNonNegativeInteger(recognizedPeriods);
  const tier = tiers.find(({ minimumPeriods, maximumPeriods }) =>
    count >= minimumPeriods && (maximumPeriods === null || count <= maximumPeriods));
  return tier?.annual ?? 0;
}

export function validateSalaryData(data) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.categories) || !data.categories.length) {
    throw new Error("Los datos retributivos no tienen el formato esperado.");
  }
  if (!Number.isInteger(data.paymentCount) || data.paymentCount <= 0) {
    throw new Error("El número de pagas no es válido.");
  }
}

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toNonNegativeMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * MONEY_PRECISION) / MONEY_PRECISION;
}
