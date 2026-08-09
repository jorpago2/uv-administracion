import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/uv-administracion/",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        example: fileURLToPath(new URL("./example.html", import.meta.url)),
        consulta: fileURLToPath(new URL("./consulta.html", import.meta.url)),
        resolver: fileURLToPath(new URL("./resolver/index.html", import.meta.url)),
        auditoria: fileURLToPath(new URL("./auditoria/index.html", import.meta.url)),
        administracion: fileURLToPath(new URL("./administracion/index.html", import.meta.url)),
        docencia: fileURLToPath(new URL("./docencia/index.html", import.meta.url)),
        programas: fileURLToPath(new URL("./programas/index.html", import.meta.url)),
        carreraPdi: fileURLToPath(new URL("./carrera-pdi/index.html", import.meta.url)),
        investigacion: fileURLToPath(new URL("./investigacion/index.html", import.meta.url)),
        gestion: fileURLToPath(new URL("./gestion/index.html", import.meta.url)),
        cumplimiento: fileURLToPath(new URL("./cumplimiento/index.html", import.meta.url)),
        financiacion: fileURLToPath(new URL("./financiacion/index.html", import.meta.url)),
        herramientas: fileURLToPath(new URL("./herramientas/index.html", import.meta.url)),
        glosario: fileURLToPath(new URL("./glosario/index.html", import.meta.url)),
        manual: fileURLToPath(new URL("./manual/index.html", import.meta.url))
      }
    }
  }
});
