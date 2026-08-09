import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/uv-administracion/",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        example: fileURLToPath(new URL("./example.html", import.meta.url))
      }
    }
  }
});
