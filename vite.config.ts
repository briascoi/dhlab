import { defineConfig } from "vitest/config";

// Los tests del motor corren en Chromium con el WASM del bundle; el resto, en Node (R6).
const MOTOR = ["test/motor.test.ts", "test/interval.test.ts", "test/personas-publicas.test.ts"];

// Cuatro páginas: la app (con el motor, Swiss Ephemeris), el panel de Isma (/admin), las condiciones (/legal) y los créditos (/creditos).
// El motor es AGPL: el código que se despliega tiene que estar publicado en el repo público (ver README).
export default defineConfig({
  build: { rollupOptions: { input: { app: "index.html", admin: "admin/index.html", legal: "legal/index.html", creditos: "creditos/index.html" } } },
  // En desarrollo, /v1 va al Worker local (`npx wrangler dev --port 8788`), con el Origin que ese Worker espera de su propio sitio.
  server: { proxy: { "/v1": { target: "http://localhost:8788", changeOrigin: true, headers: { Origin: "http://localhost:8788" } } } },
  test: {
    projects: [
      { extends: true, test: { name: "node", include: ["test/**/*.test.ts"], exclude: MOTOR } },
      { extends: true, test: { name: "motor", include: MOTOR, browser: { enabled: true, provider: "playwright", headless: true, screenshotFailures: false, instances: [{ browser: "chromium" }] } } },
    ],
  },
});
