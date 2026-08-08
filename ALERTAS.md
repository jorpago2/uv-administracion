# Alertas de vigencia, acceso y cobertura

**Auditoría:** 8 de agosto de 2026.

## Alertas prioritarias

1. **La página de normativa de personal de la UV aún referencia la Ley valenciana 10/2010**, aunque esta fue derogada y sustituida por la Ley 4/2021, de la Función Pública Valenciana. Para cuestiones actuales debe partirse de la Ley 4/2021 consolidada y comprobar sus últimas modificaciones.
2. **Varios reglamentos internos son anteriores a la LOSU y a la reforma de los Estatutos UV de 2026.** La ETSE publica un RRI de 2014, el ICMUV uno aprobado en 2008 y el DIE no muestra claramente una revisión posterior. Se conservan porque son las versiones oficiales publicadas, pero su compatibilidad con normas superiores debe comprobarse artículo por artículo cuando resulte relevante.
3. **Las normas anuales caducan o son sustituidas.** En particular: OCA 2026-2027, carrera docente 2026-2027, calendario académico 2026-2027 y calendarios ETSE de TFG/TFM.
4. **Corrección de control de calidad:** una primera prueba vinculó por error la Ley valenciana 10/2010 a `BOE-A-2010-13313`, que corresponde a una ley catalana. El catálogo vigente usa la referencia correcta `BOE-A-2010-12629`; el fichero erróneo se ha aislado en `documentos/cuarentena/` y queda fuera de todos los inventarios.

## Documentos no descargables automáticamente

| Referencia | Incidencia | Acción recomendada |
|---|---|---|
| CIUV AAPP 2024 | El servidor devuelve HTTP 401 | Acceder con sesión UV; es además una circular temporal de 2024 |
| ACGUV 36/2026 — carrera docente 2026-2027 | El PDF publicado está en un área privada y devuelve HTTP 401 | Abrir desde la red/sesión UV y guardar una copia autorizada en `documentos/unidades/` |
| ACGUV 8/2026 — calendario académico 2026-2027 | La URL publicada en `disco.uv.es` devuelve HTML, no un PDF | Acceder mediante sesión UV o localizar la copia en la sede/tablero oficial |
| ACGUV 4/2026 — dedicación docente | La norma se sirve mediante una página dinámica de `webges.uv.es` | El adjunto oficial se ha resuelto y archivado; conservar también la URL canónica del edicto para verificar su procedencia |
| Decreto 36/1995 de creación del ICMUV | La web oficial del ICMUV cita el decreto, pero no se ha localizado una copia digital oficial estable | Solicitar copia al ICMUV/Secretaría General o consultar el DOGV histórico |

## Cobertura dinámica del portal UV

El catálogo UV contiene 199 apariciones de enlaces `webges.uv.es` (169 URL únicas). Son referencias oficiales, pero el fichero adjunto se obtiene a través de una aplicación dinámica y no siempre puede descargarse sin interacción. Por eso el CSV conserva la URL oficial aunque no exista copia local.

## Cómo interpretar el repositorio

- Los inventarios con estado `descargado` o `ya_existia` han superado la comprobación de firma PDF y tienen hash SHA-256.
- Un error de descarga significa **problema de acceso**, no inexistencia o invalidez de la norma.
- Una copia local sirve para búsqueda y archivo, pero antes de actuar hay que contrastar la fecha, las modificaciones y la fuente oficial enlazada en el catálogo.
