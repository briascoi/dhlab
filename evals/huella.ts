// La huella de lo que puede mover el resultado de los evals: prompts, verificador, guardas y modelo, que viven en estos dos archivos.
// La calculan scripts/evals.ts (al guardar el resultado) y test/evals.test.ts (al comprobar que el resultado sigue vigente).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const HUELLA_DE = ["src/redactor.ts", "src/guardas.ts"];
export const huella = () => createHash("sha256").update(HUELLA_DE.map((a) => readFileSync(a, "utf8")).join("\n")).digest("hex").slice(0, 16);
