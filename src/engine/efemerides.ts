// Posiciones de los cuerpos con Swiss Ephemeris en WebAssembly, modelo Moshier (sin archivos de datos).
import { CalculationFlag, LunarPoint, Planet, SwissEphemeris } from "@swisseph/browser";
// El WASM se sirve desde el propio sitio, junto con la app.
import rutaPorDefecto from "../../node_modules/@swisseph/browser/dist/swisseph.wasm?url";
import { normalizar } from "./rueda";

export const CUERPOS = ["sol", "tierra", "luna", "nodo_norte", "nodo_sur", "mercurio", "venus", "marte", "jupiter", "saturno", "urano", "neptuno", "pluton"] as const;
export type Cuerpo = (typeof CUERPOS)[number];
export type Nodo = "verdadero" | "medio";

const PLANETAS: Partial<Record<Cuerpo, number>> = {
  sol: Planet.Sun,
  luna: Planet.Moon,
  mercurio: Planet.Mercury,
  venus: Planet.Venus,
  marte: Planet.Mars,
  jupiter: Planet.Jupiter,
  saturno: Planet.Saturn,
  urano: Planet.Uranus,
  neptuno: Planet.Neptune,
  pluton: Planet.Pluto,
};

let swe: SwissEphemeris | undefined;

export async function iniciar(rutaWasm?: string): Promise<void> {
  if (swe) return;
  const nuevo = new SwissEphemeris();
  await nuevo.init(rutaWasm ?? rutaPorDefecto);
  swe = nuevo;
}

const listo = () => {
  if (!swe) throw new Error("efemérides sin iniciar");
  return swe;
};

export const diaJuliano = (instante: Date) => listo().dateToJulianDay(instante);
export const instanteDe = (dj: number) => new Date((dj - 2440587.5) * 86_400_000);
const longitud = (dj: number, cuerpo: number) => listo().calculatePosition(dj, cuerpo as Planet, CalculationFlag.MoshierEphemeris).longitude;
export const longitudSol = (dj: number) => longitud(dj, Planet.Sun);

// Las 13 longitudes de una carta. La Tierra es el punto opuesto al Sol y el nodo sur, el opuesto al nodo norte.
export function posiciones(dj: number, nodo: Nodo): Record<Cuerpo, number> {
  const p = {} as Record<Cuerpo, number>;
  for (const cuerpo of CUERPOS) if (PLANETAS[cuerpo] !== undefined) p[cuerpo] = longitud(dj, PLANETAS[cuerpo]!);
  p.tierra = normalizar(p.sol + 180);
  p.nodo_norte = longitud(dj, nodo === "verdadero" ? LunarPoint.TrueNode : LunarPoint.MeanNode);
  p.nodo_sur = normalizar(p.nodo_norte + 180);
  return p;
}
