// Baja el texto crudo de cada página que citan las fichas y lo guarda en contenido/fuentes/, sin resumir ni pasar por ningún modelo.
// El linter del contenido (test/contenido.test.ts) exige que cada cita y cada cifra de una ficha aparezca literal en esos textos.
// Uso: node scripts/bajar-fuentes.mjs          (baja las que faltan)
//      node scripts/bajar-fuentes.mjs --todas  (vuelve a bajar todas)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

export const archivoDe = (donde) => `contenido/fuentes/${donde.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}.txt`;
// Solo páginas web: una fuente que es código (un repositorio con su commit) no se baja acá.
export const esPagina = (donde) => /^[a-z0-9.-]+\.[a-z]+\/\S+$/i.test(donde) && !donde.startsWith("github.com/");

const texto = (html) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

if (process.argv[1]?.endsWith("bajar-fuentes.mjs")) {
  mkdirSync("contenido/fuentes", { recursive: true });
  const fuentes = new Set();
  for (const a of readdirSync("contenido").filter((x) => x.endsWith(".json"))) {
    const c = JSON.parse(readFileSync(`contenido/${a}`, "utf8"));
    for (const e of [...c.fichas, ...c.experimentos]) for (const f of e.fuentes) if (esPagina(f.donde)) fuentes.add(f.donde);
  }
  for (const donde of [...fuentes].sort()) {
    const archivo = archivoDe(donde);
    if (existsSync(archivo) && !process.argv.includes("--todas")) continue;
    const r = await fetch(`https://www.${donde}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`${donde}: ${r.status}`);
    const cuerpo = texto(await r.text());
    if (cuerpo.length < 2000) throw new Error(`${donde}: la página vino casi vacía (${cuerpo.length} caracteres)`);
    writeFileSync(archivo, `Fuente: https://www.${donde}\nBajada: ${new Date().toISOString().slice(0, 10)}\n\n${cuerpo}\n`);
    console.log(`${archivo} (${cuerpo.length} caracteres)`);
  }
}
