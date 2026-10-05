// Control por huella de los evals de IA (R8): si cambian los prompts, el verificador, las guardas o el modelo, hay que volver a
// correr `scripts/evals.ts` (en la máquina de Isma, con su clave) y commitear el resultado aprobado. Acá no se usa ninguna clave.
// Para encender la IA incluida hay que quitar IA_PAUSA de wrangler.jsonc, y entonces este test exige el resultado aprobado.
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { huella } from "../evals/huella";

// La puerta vale mientras la IA incluida esté encendida: con la pausa puesta en wrangler.jsonc, nadie recibe texto generado.
// Se miran solo las líneas de configuración, no los comentarios.
const enPausa = /"IA_PAUSA":\s*"1"/.test(readFileSync("wrangler.jsonc", "utf8").replace(/^\s*\/\/.*$/gm, ""));

test.skipIf(enPausa)("hay un resultado de evals aprobado para los prompts, las guardas y el modelo actuales", () => {
  expect(existsSync("evals/resultado.json"), "falta evals/resultado.json: correr scripts/evals.ts").toBe(true);
  const r = JSON.parse(readFileSync("evals/resultado.json", "utf8")) as { huella: string; aprobado: boolean; modelo: string; verificador: string };
  // El resultado vale para el verificador con el que se midió: tiene que ser el que usa producción (IA_VERIFICADOR, o el modelo del redactor).
  const configurado = /"IA_VERIFICADOR":\s*"([^"]+)"/.exec(readFileSync("wrangler.jsonc", "utf8"))?.[1] ?? r.modelo;
  expect(r.verificador, "los evals aprobados se midieron con otro verificador que el configurado en wrangler.jsonc").toBe(configurado);
  expect(r.huella, "los prompts, las guardas o el modelo cambiaron desde los últimos evals: correr scripts/evals.ts").toBe(huella());
  expect(r.aprobado, "los últimos evals no alcanzaron los umbrales").toBe(true);
});
