// Cliente de la IA incluida (/v1/ia): la app manda solo la acción y los atributos de la carta; el pedido al modelo lo arma el servidor.
import type { Fallo } from "./cuenta-api";
import type { Parrafo } from "./guardas";
import type { Atributos } from "./piezas";

export interface EstadoIA { configurada: boolean; usado: number; tope: number; pausa: boolean; renovacion: string; reserva: { capitulo: number; mensaje: number } }
// Una sección escrita por la IA, tal como se guarda en el Libro: con qué modelo, cuál la verificó y qué versión de cada ficha usó.
export interface Seccion { esquema: 1; parrafos: Parrafo[]; modelo: string; verificador: string; fichas: { id: string; version: number }[]; escrita: string }
export type Respuesta = { parrafos: Parrafo[] } | { fija: "sensible" | "ciencia" | "sin_biblioteca" };
export interface Turno { rol: "persona" | "coach"; texto: string }

async function pedir<T>(cuerpo?: object, senal?: AbortSignal): Promise<T | Fallo> {
  try {
    const init = cuerpo ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo), signal: senal ?? null } : undefined;
    return (await (await fetch("/v1/ia", init)).json()) as T | Fallo;
  } catch {
    return { error: senal?.aborted ? "cancelado" : "sin_red" };
  }
}

export const iaApi = {
  estado: () => pedir<EstadoIA>(),
  capitulo: (n: number, atributos: Atributos, senal: AbortSignal) => pedir<Omit<Seccion, "esquema" | "escrita">>({ accion: "capitulo", n, atributos }, senal),
  // El historial va corto: los últimos seis turnos.
  mensaje: (texto: string, historial: Turno[], atributos: Atributos) => pedir<Respuesta>({ accion: "mensaje", texto, historial: historial.slice(-6), atributos }),
};
