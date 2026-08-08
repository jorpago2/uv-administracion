# Repositorio normativo UV — PDI, ETSE, DIE e ICMUV

## Interfaz web

La guía dispone de una [interfaz web estática](web/README.md) con búsqueda, filtros, índice navegable, vista de impresión y una calculadora de retribuciones PDI basada en las tablas oficiales UV de 2026. El contenido documental se genera desde `MANUAL_PROCEDIMIENTOS.md` mediante `scripts/generar_datos_web.ps1`.

**Web publicada:** <https://jorpago2.github.io/uv-administracion/>

Recopilación reproducible de fuentes oficiales para el trabajo docente, investigador y administrativo de un profesor de la Universitat de València adscrito al Departamento de Ingeniería Electrónica, con docencia en la ETSE y actividad en el ICMUV.

**Fecha de comprobación:** 8 de agosto de 2026.

## Qué contiene

| Capa | Catálogo | Resultado de la descarga |
|---|---:|---:|
| Estado, Unión Europea y Generalitat Valenciana | 56 normas seleccionadas | 56 documentos verificados |
| Catálogo general público de normativa UV | 373 registros; 324 URL oficiales únicas | 149 PDF directos verificados; 3 no accesibles sin sesión o mediante el enlace publicado |
| Selección ETSE–DIE–ICMUV y normas UV de uso frecuente | 20 registros | 18 documentos verificados; 1 PDF restringido; 1 referencia histórica sin PDF estable |

Los inventarios registran URL de origen, ruta local, tamaño, estado, fecha y hash SHA-256. El árbol físico contiene algunas copias idénticas en más de una capa para que cada colección sea autocontenida; los hashes permiten reconocerlas.

## Entrada recomendada

1. Empezar por [`MANUAL_PROCEDIMIENTOS.md`](MANUAL_PROCEDIMIENTOS.md) para resolver una situación práctica.
2. Consultar [`catalogos/unidades_especificas.csv`](catalogos/unidades_especificas.csv) para las reglas más cercanas al trabajo diario en ETSE, DIE e ICMUV.
3. Consultar [`catalogos/nucleo_estatal_autonomico.csv`](catalogos/nucleo_estatal_autonomico.csv) para el marco estatal, europeo y valenciano.
4. Buscar por referencia o palabras clave en [`catalogos/uv_reglamentos.csv`](catalogos/uv_reglamentos.csv) para cualquier reglamento publicado en el portal general de la UV.
5. Revisar [`ALERTAS.md`](ALERTAS.md) antes de tomar una decisión con efectos jurídicos o administrativos.

## Mapa rápido por necesidad

| Necesidad | Primeras normas que conviene revisar |
|---|---|
| Relación de servicio, derechos y deberes | LOSU; TREBEP o Estatuto de los Trabajadores según vínculo; Ley valenciana 4/2021; Estatutos UV; convenio colectivo o acuerdos aplicables |
| Dedicación, POD/OCA y carrera docente | LOSU; RD 898/1985 y RD 1086/1989 en lo que sigan aplicándose; Reglamento UV de dedicación ACGUV 4/2026; OCA ACGUV 251/2025; criterios de carrera ACGUV 36/2026 |
| Evaluación, exámenes, TFG y TFM | RD 822/2021; Estatuto del Estudiante; normativa UV de evaluación; ACGUV 206/2024; directrices y calendarios ETSE |
| Prácticas externas | RD 592/2014; normativa UV aplicable; normativa específica ETSE de 10/02/2026 |
| Investigación, contratos y subvenciones | Ley 14/2011 de la Ciencia; Ley 9/2017 de Contratos; Ley 38/2003 de Subvenciones y su reglamento; normas UV de investigación |
| Propiedad intelectual, patentes y confidencialidad | Texto refundido de propiedad intelectual; Ley 24/2015 de Patentes; Ley 1/2019 de Secretos Empresariales; RD 55/2002; anexos UV de confidencialidad TFG/TFM |
| Datos personales y transparencia | RGPD; LO 3/2018; Ley 19/2013; Ley valenciana 1/2022; reglamentación UV de administración electrónica y transparencia |
| Laboratorios, equipos y seguridad | Ley 31/1995; RD 39/1997; plan de autoprotección y normas ETSE; evaluación de riesgos y protocolos específicos vigentes del laboratorio |
| Órganos y funcionamiento de UV, ETSE, DIE e ICMUV | Estatutos UV 2026; reglamentos de régimen interno de ETSE, DIE e ICMUV; Leyes 39/2015 y 40/2015 para procedimiento y órganos colegiados cuando proceda |

## Estructura

```text
catalogos/
  nucleo_estatal_autonomico.csv
  uv_reglamentos.csv
  unidades_especificas.csv
  inventario_descargas_nucleo.csv
  inventario_descargas_uv.csv
  inventario_descargas_unidades.csv
documentos/
  nucleo/
  uv/
  unidades/
scripts/
  recopilar_catalogo_uv.ps1
  descargar_documentos.ps1
  comprobar_enlaces.mjs
ALERTAS.md
```

## Actualización reproducible

Desde PowerShell, en la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\recopilar_catalogo_uv.ps1

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\descargar_documentos.ps1 `
  -Catalogo .\catalogos\uv_reglamentos.csv `
  -Destino .\documentos\uv `
  -Inventario .\catalogos\inventario_descargas_uv.csv `
  -ColumnaUrl url_documento -ColumnaTitulo titulo `
  -ColumnaReferencia referencia -SoloPdf
```

El mismo descargador puede aplicarse a los otros dos catálogos cambiando rutas y usando la columna `url_pdf`. Para `unidades_especificas.csv` debe añadirse `-ForzarPdf`, porque el adjunto de ACGUV 4/2026 se sirve desde una URL dinámica terminada en `.do` aunque su contenido sea PDF.

Los enlaces del manual pueden comprobarse con:

```powershell
node .\scripts\comprobar_enlaces.mjs
```

## Criterios y límites

- Se han usado únicamente fuentes oficiales: BOE, EUR-Lex, DOGV/GVA y dominios de la Universitat de València.
- Un texto consolidado facilita la consulta, pero no sustituye a la publicación oficial ni garantiza por sí solo qué redacción era aplicable en una fecha pasada.
- `vigente`, `histórica`, `derogada` y `vigencia_por_confirmar` son etiquetas de orientación, no un dictamen jurídico.
- El portal UV contiene normas antiguas junto a normas vigentes y algunos enlaces privados o dinámicos. La mera aparición en el portal no demuestra vigencia material.
- No se incluyen convocatorias individuales, resoluciones personales, guías docentes de cada asignatura, acuerdos no publicados, instrucciones recibidas solo por correo o intranet, ni protocolos locales que no tengan una URL pública estable.
- Los calendarios, OCA, criterios de carrera y procedimientos de TFG/TFM deben revisarse cada curso.

Para una actuación con plazo, recurso, responsabilidad disciplinaria, contratación, propiedad intelectual o conflicto laboral, debe verificarse la versión vigente en la sede oficial y, si procede, consultarse al servicio UV competente o a asesoramiento jurídico/sindical.
