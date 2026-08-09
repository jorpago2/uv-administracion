export function guideBelongsToArea(guide, areaId) {
  if (!guide || typeof areaId !== "string") return false;
  if (areaId === "planificacion") return guide.categoryId === "incorporacion" && guide.situationNumber <= 5;
  if (areaId === "pdi") return guide.categoryId === "incorporacion" && ((guide.situationNumber >= 7 && guide.situationNumber <= 10) || (guide.situationNumber >= 51 && guide.situationNumber <= 60));
  if (areaId === "docencia") return guide.categoryId === "docencia" || guide.id === "corregir-pod-oca";
  return guide.categoryId === areaId;
}
