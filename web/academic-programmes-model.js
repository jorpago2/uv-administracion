export const DOCUMENT_TYPES = Object.freeze([
  { id: "", label: "Todos los documentos" },
  { id: "verifica", label: "Memorias Verifica" },
  { id: "plan", label: "Planes, guías y organización" },
  { id: "seguimiento", label: "Seguimiento y acreditación" },
  { id: "ficha", label: "Fichas oficiales" }
]);

export function validateAcademicProgrammes(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.programmes) || !Array.isArray(data.structures)) {
    throw new TypeError("Catálogo académico no válido.");
  }
  const ids = new Set();
  for (const programme of data.programmes) {
    if (!programme.id || ids.has(programme.id)) throw new TypeError(`Identificador académico duplicado o vacío: ${programme.id ?? ""}.`);
    ids.add(programme.id);
    for (const field of ["acronym", "name", "level", "scope", "uvCode", "governance", "firstCheck"]) {
      if (!String(programme[field] ?? "").trim()) throw new TypeError(`${programme.id}: falta ${field}.`);
    }
    if (!Array.isArray(programme.documents) || programme.documents.length < 4) throw new TypeError(`${programme.id}: faltan familias documentales.`);
    for (const document of programme.documents) {
      if (!DOCUMENT_TYPES.some((type) => type.id === document.type)) throw new TypeError(`${programme.id}: tipo documental desconocido ${document.type}.`);
      if (!/^https:\/\//.test(document.url)) throw new TypeError(`${programme.id}: enlace documental no seguro.`);
    }
  }
  return data;
}

export function filterAcademicProgrammes(programmes, filters = {}) {
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
  return programmes.flatMap((programme) => {
    if (filters.scope && programme.scope !== filters.scope) return [];
    if (filters.level && programme.level !== filters.level) return [];
    const programmeText = normalize([programme.acronym, programme.name, programme.uvCode, programme.ructId, programme.centre, programme.department, programme.governance].join(" "));
    const programmeMatches = terms.every((term) => programmeText.includes(term));
    const documents = programme.documents.filter((document) => {
      if (filters.documentType && document.type !== filters.documentType) return false;
      if (!terms.length || programmeMatches) return true;
      const documentText = normalize([document.typeLabel, document.title, document.purpose, document.status].join(" "));
      return terms.every((term) => documentText.includes(term));
    });
    return documents.length ? [{ ...programme, documents }] : [];
  });
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}
