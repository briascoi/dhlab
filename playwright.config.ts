import { defineConfig } from "@playwright/test";

// E2E de la app sobre el servidor de desarrollo (Vite). El servidor de cuentas se simula a nivel de red (`e2e/servidor.ts`).
export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  use: { baseURL: "http://localhost:5199", locale: "es-ES" },
  webServer: { command: "npm run ciudades && npx vite --port 5199 --strictPort", url: "http://localhost:5199/", reuseExistingServer: !process.env.CI },
});
