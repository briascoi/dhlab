// Arma public/contenido.json: el catálogo de fichas (id, texto y versión) que el Worker de la IA lee para armar los pedidos.
// Sin la carpeta `contenido/` (copia pública del código) queda vacío, y la IA incluida responde que no está configurada.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const fichas = {};
if (existsSync("contenido")) {
  for (const a of readdirSync("contenido").filter((x) => x.endsWith(".json"))) {
    for (const f of JSON.parse(readFileSync(`contenido/${a}`, "utf8")).fichas) fichas[f.id] = { texto: f.texto, version: f.version };
  }
}
mkdirSync("public", { recursive: true });
writeFileSync("public/contenido.json", JSON.stringify({ fichas }));
console.log(`public/contenido.json: ${Object.keys(fichas).length} fichas`);
