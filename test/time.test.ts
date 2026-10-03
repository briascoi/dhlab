import { existsSync, readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
import { VERSION_TZDB, aUtc, husoConocido } from "../src/engine/time";

const iso = (r: { instantes: Date[] }) => r.instantes.map((d) => d.toISOString());

test("la tabla de husos está fijada y dice su versión", () => {
  expect(VERSION_TZDB).toMatch(/^20\d\d[a-z]$/);
});

test("hora local a UTC en casos normales", () => {
  expect(iso(aUtc("1985-03-14", "07:30", "America/Argentina/Buenos_Aires"))).toEqual(["1985-03-14T10:30:00.000Z"]);
  expect(iso(aUtc("1990-07-01", "12:00", "Europe/Madrid"))).toEqual(["1990-07-01T10:00:00.000Z"]);
  expect(aUtc("1990-07-01", "12:00", "Europe/Madrid").estado).toBe("unica");
});

test("desfases históricos de Argentina antes de 1970", () => {
  // 1960: horario de verano continuo desde 1946, UTC-3. 2008: horario de verano, UTC-2.
  expect(iso(aUtc("1960-06-01", "12:00", "America/Argentina/Buenos_Aires"))).toEqual(["1960-06-01T15:00:00.000Z"]);
  expect(iso(aUtc("2008-01-15", "12:00", "America/Argentina/Buenos_Aires"))).toEqual(["2008-01-15T14:00:00.000Z"]);
  // Antes de 1894 regía la hora local de Buenos Aires, a 3 h 53 min 48 s de UTC.
  expect(iso(aUtc("1890-01-01", "12:00", "America/Argentina/Buenos_Aires"))).toEqual(["1890-01-01T15:53:48.000Z"]);
});

test("hora inexistente y hora repetida por el cambio de horario", () => {
  expect(aUtc("2024-03-31", "02:30", "Europe/Madrid")).toEqual({ estado: "inexistente", instantes: [] });
  const repetida = aUtc("2024-10-27", "02:30", "Europe/Madrid");
  expect(repetida.estado).toBe("repetida");
  expect(iso(repetida)).toEqual(["2024-10-27T00:30:00.000Z", "2024-10-27T01:30:00.000Z"]);
});

// Cada huso que traen los archivos de localidades tiene que existir en la tabla empaquetada.
test.skipIf(!existsSync("public/ciudades/indice.json"))("todos los husos de las localidades existen en la tabla", () => {
  const husos = new Set<string>();
  for (const archivo of readdirSync("public/ciudades")) {
    if (archivo === "indice.json") continue;
    for (const c of JSON.parse(readFileSync(`public/ciudades/${archivo}`, "utf8")) as [string, string, number, number, string][]) husos.add(c[4]);
  }
  expect(husos.size).toBeGreaterThan(300);
  expect([...husos].filter((h) => !husoConocido(h))).toEqual([]);
});

import { rangoDeNacimiento } from "../src/engine/nacimiento";

test("el rango a calcular depende de la confiabilidad de la hora", () => {
  const base = { fecha: "1985-03-14", hora: "07:30", margen: 20, huso: "America/Argentina/Buenos_Aires" };
  const horas = (r: ReturnType<typeof rangoDeNacimiento>) => (r.estado === "listo" ? [r.inicio.toISOString().slice(11, 16), r.fin.toISOString().slice(11, 16)] : r.estado);
  expect(horas(rangoDeNacimiento({ ...base, confiabilidad: "exacta" }))).toEqual(["10:25", "10:35"]);
  expect(horas(rangoDeNacimiento({ ...base, confiabilidad: "aproximada" }))).toEqual(["10:10", "10:50"]);
  // Hora desconocida: el día local completo, de 03:00 UTC a 03:00 UTC del día siguiente.
  const dia = rangoDeNacimiento({ ...base, confiabilidad: "desconocida" });
  expect(dia.estado === "listo" && [dia.inicio.toISOString(), dia.fin.toISOString()]).toEqual(["1985-03-14T03:00:00.000Z", "1985-03-15T03:00:00.000Z"]);
  expect(rangoDeNacimiento({ fecha: "2024-10-27", hora: "02:30", margen: 0, huso: "Europe/Madrid", confiabilidad: "exacta" })).toMatchObject({ estado: "repetida" });
});
