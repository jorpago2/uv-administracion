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

## Publicación

Cada cambio enviado a la rama `main` activa el flujo `.github/workflows/deploy-pages.yml`. El flujo instala las dependencias bloqueadas, compila la aplicación y publica `web/dist/` en <https://jorpago2.github.io/uv-administracion/>.

## Estructura

- `index.html`: estructura semántica y contenido inicial.
- `tokens.css`: paleta, tipografías, escalas, bordes, sombras y movimiento.
- `styles.css`: diseño responsive, impresión y estados de interacción.
- `app.js`: importación Vite, validación, transformación Markdown, búsqueda, filtros e índice.
- `data/manual.json`: dato generado; no debe editarse a mano.
- `public/`: copias generadas de los recursos documentales enlazados.

La interfaz funciona a partir de 320 px, con navegación por teclado, foco visible, reducción de movimiento y una versión de impresión sin controles.
