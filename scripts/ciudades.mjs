// Parte el dataset cities1000 de GeoNames en un archivo por país (R10): nombre, provincia, latitud, longitud y huso IANA.
// GeoNames: licencia CC BY 4.0, https://download.geonames.org/export/dump/ (atribución en la página de créditos).
// Uso: node scripts/ciudades.mjs [--forzar]. Deja los archivos en public/ciudades/ (no se versionan).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DESTINO = "public/ciudades";
if (existsSync(join(DESTINO, "indice.json")) && !process.argv.includes("--forzar")) process.exit(0);

const BASE = "https://download.geonames.org/export/dump/";
const tmp = mkdtempSync(join(tmpdir(), "geonames-"));
async function bajar(archivo) {
  const r = await fetch(BASE + archivo);
  if (!r.ok) throw new Error(`${archivo}: ${r.status}`);
  const ruta = join(tmp, archivo);
  writeFileSync(ruta, Buffer.from(await r.arrayBuffer()));
  return ruta;
}

const zip = await bajar("cities1000.zip");
const provincias = new Map(
  readFileSync(await bajar("admin1CodesASCII.txt"), "utf8").split("\n").filter(Boolean).map((l) => l.split("\t").slice(0, 2)),
);
const filas = execFileSync("unzip", ["-p", zip, "cities1000.txt"], { maxBuffer: 1 << 30 }).toString("utf8").split("\n").filter(Boolean);

const porPais = new Map();
for (const fila of filas) {
  const c = fila.split("\t");
  const pais = c[8];
  if (!pais || !c[17]) continue;
  const lista = porPais.get(pais) ?? [];
  // [nombre, provincia, latitud, longitud, huso]
  lista.push([c[1], provincias.get(`${pais}.${c[10]}`) ?? "", Number(c[4]), Number(c[5]), c[17]]);
  porPais.set(pais, lista);
}

mkdirSync(DESTINO, { recursive: true });
const indice = {};
for (const [pais, lista] of [...porPais].sort()) {
  lista.sort((a, b) => a[0].localeCompare(b[0], "es"));
  writeFileSync(join(DESTINO, `${pais}.json`), JSON.stringify(lista));
  indice[pais] = lista.length;
}
writeFileSync(join(DESTINO, "indice.json"), JSON.stringify(indice));
console.log(`ciudades: ${filas.length} localidades en ${porPais.size} países`);
