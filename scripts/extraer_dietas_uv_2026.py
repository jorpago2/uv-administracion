"""Extrae las cuantías del Anexo 1b del Presupuesto UV 2026.

Uso:
    python scripts/extraer_dietas_uv_2026.py PDF_ENTRADA JSON_SALIDA

El PDF debe proceder de:
https://www.uv.es/contab/documents/Presup/P26_3_Annex1b_D1.pdf
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pdfplumber


def extract_foreign_rates(pdf_path: Path) -> list[dict[str, float | str]]:
    rates: dict[str, dict[str, float]] = {}
    with pdfplumber.open(pdf_path) as document:
        for page in document.pages:
            for table in page.extract_tables():
                for raw_row in table:
                    cells = [(cell or "").strip() for cell in raw_row]
                    for index, cell in enumerate(cells[:-1]):
                        if ": allotjament" not in cell and ": manutenci" not in cell:
                            continue
                        country = cell.split(": ", 1)[0]
                        concept = "lodging" if ": allotjament" in cell else "meals"
                        value = float(cells[index + 1].replace(".", "").replace(",", "."))
                        rates.setdefault(country, {})[concept] = value

    # La celda de manutención de Àustria se solapa con la segunda columna y
    # pdfplumber no la asocia a su fila; la cuantía se verifica visualmente.
    rates.setdefault("Àustria", {})["meals"] = 85.94
    incomplete = [country for country, values in rates.items() if set(values) != {"lodging", "meals"}]
    if incomplete:
        raise ValueError(f"Destinos incompletos: {', '.join(incomplete)}")
    if len(rates) != 97:
        raise ValueError(f"Se esperaban 97 destinos y se extrajeron {len(rates)}")

    return [
        {"id": f"foreign-{index:03d}", "label": country, **rates[country]}
        for index, country in enumerate(sorted(rates, key=str.casefold), start=1)
    ]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Uso: extraer_dietas_uv_2026.py PDF_ENTRADA JSON_SALIDA")
    pdf_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()
    data = {
        "schemaVersion": 1,
        "year": 2026,
        "reviewedOn": "2026-08-08",
        "source": "https://www.uv.es/contab/documents/Presup/P26_3_Annex1b_D1.pdf",
        "mileage": {"car": 0.26, "motorcycle": 0.106},
        "domestic": {
            "madridBarcelonaLodging": 140.0,
            "restSpainLodging": 100.0,
            "meals": 53.34,
        },
        "foreign": extract_foreign_rates(pdf_path),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
