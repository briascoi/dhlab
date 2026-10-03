import { CANALES, CENTRO_DE_PUERTA, type Canal, type CentroId } from "./system-data";

// Un Canal está definido si sus dos Puertas están activas; un Centro, si tiene al menos un Canal definido.
export function definicion(puertasActivas: Iterable<number>): { canales: Canal[]; centros: Set<CentroId> } {
  const activas = new Set(puertasActivas);
  const canales = CANALES.filter(({ puertas: [a, b] }) => activas.has(a) && activas.has(b));
  const centros = new Set(canales.flatMap(({ puertas }) => puertas.map((p) => CENTRO_DE_PUERTA[p]!)));
  return { canales, centros };
}
