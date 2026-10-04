// Importar un archivo exportado (DR43): validar, clasificar contra lo que hay en el dispositivo y combinar sin reemplazar nada en silencio.
// Sin DOM ni almacén: recibe textos y devuelve qué hacer.
import type { Tipo } from "./cuenta-api";

// `contenido` es el texto tal como se guarda: JSON para carta y libro, y el texto legible de la entrada para el diario.
export interface Pieza { tipo: Tipo; id: string; contenido: string }
const TIPOS: Tipo[] = ["carta", "libro", "diario"];
// Los ids del archivo se conservan, así que importar dos veces lo mismo da "ya existe".
export const clave = (p: { tipo: string; id: string }) => `${p.tipo}/${p.id}`;
// Una entrada del diario que choca queda al lado de la original, como versión de otro dispositivo (DR37).
export const otraVersion = (p: Pieza): Pieza => ({ tipo: p.tipo, id: `${p.id}~otra`, contenido: JSON.stringify({ ...(JSON.parse(p.contenido) as object), versionDe: p.id }) });

export function leerArchivo(texto: string): { piezas: Pieza[] } | { error: "invalido" | "esquema_nuevo" } {
  let archivo: { esquema?: unknown; documentos?: unknown };
  try {
    archivo = JSON.parse(texto) as typeof archivo;
  } catch {
    return { error: "invalido" };
  }
  if (typeof archivo !== "object" || archivo === null || typeof archivo.esquema !== "number" || !Array.isArray(archivo.documentos)) return { error: "invalido" };
  if (archivo.esquema > 1) return { error: "esquema_nuevo" };
  const piezas: Pieza[] = [];
  for (const d of archivo.documentos as { tipo?: unknown; id?: unknown; contenido?: unknown }[]) {
    if (!TIPOS.includes(d?.tipo as Tipo) || typeof d.id !== "string" || !d.id || d.id.length > 56 || d.contenido == null) return { error: "invalido" };
    // El diario exportado es texto; carta y libro, objetos.
    if ((d.tipo === "diario") !== (typeof d.contenido === "string")) return { error: "invalido" };
    try {
      piezas.push({ tipo: d.tipo as Tipo, id: d.id, contenido: d.tipo === "diario" ? JSON.stringify(JSON.parse(d.contenido as string)) : JSON.stringify(d.contenido) });
    } catch {
      return { error: "invalido" };
    }
  }
  return { piezas };
}

// `locales`: lo que hay en el dispositivo, por tipo e id, con el diario ya descifrado.
export function clasificar(piezas: Pieza[], locales: Map<string, string>) {
  const igual = (p: Pieza) => {
    const local = locales.get(clave(p));
    return local !== undefined && JSON.stringify(JSON.parse(local)) === p.contenido;
  };
  const r = { nuevo: [] as Pieza[], existe: [] as Pieza[], conflicto: [] as Pieza[] };
  for (const p of piezas) {
    if (!locales.has(clave(p))) r.nuevo.push(p);
    else if (igual(p) || (p.tipo === "diario" && igual(otraVersion(p)))) r.existe.push(p);
    else r.conflicto.push(p);
  }
  return r;
}
