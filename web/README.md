# Interfaz web de la guía operativa UV

Frontend Vite sin backend. El contenido procede de `../MANUAL_PROCEDIMIENTOS.md` y se transforma en `data/manual.json`.

## Regenerar los datos

Desde la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\generar_datos_web.ps1
```

Ejecuta este paso después de modificar el manual. También actualiza `public/` con el manual, las alertas y los catálogos enlazados.

## Desarrollo local

Desde `web/`:

```text
pnpm install
pnpm dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173/`.

## Build de producción

```text
pnpm build
pnpm preview
```

El resultado se escribe en `web/dist/`.

## Pruebas

```text
pnpm test
```

Las pruebas comprueban casos de PDI funcionario y laboral, los tramos autonómicos y los complementos por cargo académico.

## Publicación

Cada cambio enviado a la rama `main` activa el flujo `.github/workflows/deploy-pages.yml`. El flujo instala las dependencias bloqueadas, compila la aplicación y publica `web/dist/` en <https://jorpago2.github.io/uv-administracion/>.

## Estructura

- `index.html`: estructura semántica y contenido inicial.
- `tokens.css`: paleta, tipografías, escalas, bordes, sombras y movimiento.
- `styles.css`: diseño responsive, impresión y estados de interacción.
- `app.js`: importación Vite, validación, transformación Markdown, búsqueda, filtros e índice.
- `chapter-categories.js`: mapa comprobable entre capítulos y ámbitos de la guía.
- `salary-calculator.js`: controles y representación de la calculadora retributiva.
- `salary-model.js`: cálculo puro y validable de los importes anuales.
- `data/manual.json`: dato generado; no debe editarse a mano.
- `data/salaries-2026.json`: importes transcritos de las fuentes oficiales UV de 2026; debe revisarse al cambiar el ejercicio.
- `public/`: copias generadas de los recursos documentales enlazados.

La interfaz funciona a partir de 320 px, con navegación por teclado, foco visible, reducción de movimiento y una versión de impresión sin controles.
