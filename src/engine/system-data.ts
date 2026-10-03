// Tabla única del sistema (T9): Centros, Puertas y Canales.
// Fuente: "36 Channels of the Human Design Chart", humandesignsystem.co/en/36-channels-of-the-human-design-chart/
// (leída el 2026-10-03). De ahí se transcriben los 36 Canales con sus dos Puertas y sus dos Centros.
// La asignación de cada Puerta a su Centro se contrasta contra esos pares en test/topologia.test.ts.
// Pendiente: segunda fuente (SharpAstrology, T11) y nombres en español que fija Isma.

export const CENTROS = {
  cabeza: "Cabeza",
  ajna: "Ajna",
  garganta: "Garganta",
  g: "G",
  corazon: "Corazón",
  sacral: "Sacral",
  plexo: "Plexo Solar",
  bazo: "Bazo",
  raiz: "Raíz",
} as const;

export type CentroId = keyof typeof CENTROS;

const PUERTAS_POR_CENTRO: Record<CentroId, number[]> = {
  cabeza: [64, 61, 63],
  ajna: [47, 24, 4, 17, 43, 11],
  garganta: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16],
  g: [1, 13, 25, 46, 2, 15, 10, 7],
  corazon: [21, 40, 26, 51],
  sacral: [5, 14, 29, 59, 9, 3, 42, 27, 34],
  plexo: [6, 37, 22, 36, 30, 55, 49],
  bazo: [48, 57, 44, 50, 32, 28, 18],
  raiz: [58, 38, 54, 53, 60, 52, 19, 39, 41],
};

export const CENTRO_DE_PUERTA: Record<number, CentroId> = Object.fromEntries(
  Object.entries(PUERTAS_POR_CENTRO).flatMap(([centro, puertas]) => puertas.map((p) => [p, centro as CentroId])),
);

export interface Canal {
  puertas: [number, number];
  // Par de Centros tal como lo da la fuente (sin orden).
  centros: [CentroId, CentroId];
}

const c = (a: number, b: number, x: CentroId, y: CentroId): Canal => ({ puertas: [a, b], centros: [x, y] });

export const CANALES: Canal[] = [
  c(61, 24, "cabeza", "ajna"),
  c(43, 23, "ajna", "garganta"),
  c(8, 1, "garganta", "g"),
  c(2, 14, "g", "sacral"),
  c(3, 60, "sacral", "raiz"),
  c(39, 55, "raiz", "plexo"),
  c(22, 12, "plexo", "garganta"),
  c(38, 28, "raiz", "bazo"),
  c(34, 57, "bazo", "sacral"),
  c(57, 10, "bazo", "g"),
  c(57, 20, "bazo", "garganta"),
  c(34, 10, "sacral", "g"),
  c(34, 20, "sacral", "garganta"),
  c(20, 10, "garganta", "g"),
  c(25, 51, "g", "corazon"),
  c(45, 21, "garganta", "corazon"),
  c(40, 37, "plexo", "corazon"),
  c(59, 6, "sacral", "plexo"),
  c(19, 49, "raiz", "plexo"),
  c(54, 32, "raiz", "bazo"),
  c(50, 27, "sacral", "bazo"),
  c(44, 26, "bazo", "corazon"),
  c(64, 47, "cabeza", "ajna"),
  c(63, 4, "cabeza", "ajna"),
  c(17, 62, "ajna", "garganta"),
  c(11, 56, "ajna", "garganta"),
  c(31, 7, "garganta", "g"),
  c(33, 13, "garganta", "g"),
  c(15, 5, "g", "sacral"),
  c(46, 29, "g", "sacral"),
  c(42, 53, "sacral", "raiz"),
  c(9, 52, "sacral", "raiz"),
  c(18, 58, "raiz", "bazo"),
  c(30, 41, "raiz", "plexo"),
  c(36, 35, "plexo", "garganta"),
  c(48, 16, "bazo", "garganta"),
];
