// De la fecha y hora local de nacimiento al instante UTC, con una tabla de husos fijada y empaquetada (no la del navegador).
import * as tc from "timezonecomplete";
import tzdata from "tzdata";

tc.TzDatabase.init(tzdata);

// Versión de la base IANA con la que se calculó; queda registrada en cada carta.
export const VERSION_TZDB: string = (tzdata as { version: string }).version;

export interface HoraLocal {
  // "unica": el caso normal. "inexistente": el reloj saltó esa hora (cambio a horario de verano).
  // "repetida": esa hora ocurrió dos veces (vuelta del horario de verano) y hay que preguntar cuál.
  estado: "unica" | "inexistente" | "repetida";
  instantes: Date[];
}

export const husoConocido = (huso: string) => tc.TzDatabase.instance().exists(huso);

function desfaseEn(huso: string, utc: number): number {
  const d = new Date(utc);
  return tc.zone(huso).offsetForUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), 0);
}

export function aUtc(fecha: string, hora: string, huso: string): HoraLocal {
  const [a, m, d] = fecha.split("-").map(Number) as [number, number, number];
  const [h, min] = hora.split(":").map(Number) as [number, number];
  const reloj = Date.UTC(a, m - 1, d, h, min);
  // Un instante es válido si, con el desfase vigente en ese instante, el reloj local marca la hora pedida.
  const instantes = new Set<number>();
  for (const cerca of [reloj - 86_400_000, reloj, reloj + 86_400_000]) {
    const candidato = reloj - desfaseEn(huso, cerca) * 60_000;
    if (candidato + desfaseEn(huso, candidato) * 60_000 === reloj) instantes.add(candidato);
  }
  const lista = [...instantes].sort((x, y) => x - y).map((t) => new Date(t));
  return { estado: lista.length === 0 ? "inexistente" : lista.length === 1 ? "unica" : "repetida", instantes: lista };
}
