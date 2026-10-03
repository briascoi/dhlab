// La rueda: de la longitud eclíptica a Puerta, Línea, Color, Tono y Base.
// Fuente de las constantes y del orden: SharpAstrology.HumanDesign (licencia MIT), Utility/HumanDesignUtility.cs y Enums/Gates.cs,
// github.com/CReizner/SharpAstrology.HumanDesign, leído el 2026-10-03. La Puerta 17 empieza en 3,875° (3°52'30" de Aries)
// y cada Puerta ocupa 5,625°; con eso la Puerta 41 empieza en 302° (2° de Acuario).

const DESFASE = 3.875;
// La rueda completa en unidades de Base: 64 Puertas x 6 Líneas x 6 Colores x 6 Tonos x 5 Bases.
const UNIDADES = 64 * 6 * 6 * 6 * 5;

export const RUEDA = [
  17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46,
  18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60, 41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25,
] as const;

export interface Activacion {
  longitud: number;
  puerta: number;
  linea: number;
  color: number;
  tono: number;
  base: number;
}

export const normalizar = (grados: number) => ((grados % 360) + 360) % 360;

export function activacion(longitud: number): Activacion {
  // Se cuenta en unidades enteras para que un límite exacto (por ejemplo 302°) no caiga del lado equivocado por redondeo.
  const u = Math.floor((normalizar(longitud - DESFASE) / 360) * UNIDADES + 1e-7) % UNIDADES;
  return {
    longitud: normalizar(longitud),
    puerta: RUEDA[Math.floor(u / 1080)]!,
    linea: (Math.floor(u / 180) % 6) + 1,
    color: (Math.floor(u / 30) % 6) + 1,
    tono: (Math.floor(u / 5) % 6) + 1,
    base: (u % 5) + 1,
  };
}
