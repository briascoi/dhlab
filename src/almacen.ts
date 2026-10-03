// Almacén del navegador para la sincronización (T64): una base IndexedDB por cuenta, y el contenido de la carta guardada.
import type { Almacen, Store } from "./sync";
import type { Nacimiento } from "./ui/nacimiento";

// Una base IndexedDB por cuenta. El número de versión de la base es el `schemaVersion` de R4:
// cada cambio de esquema suma una rama por `oldVersion` en `onupgradeneeded`.
export function abrirAlmacen(email: string): Almacen {
  const base = new Promise<IDBDatabase>((ok, mal) => {
    const p = indexedDB.open(`dhlab:${email}`, 2);
    p.onupgradeneeded = (e) => {
      if (e.oldVersion < 1) {
        p.result.createObjectStore("documentos", { keyPath: "clave" });
        p.result.createObjectStore("cola", { keyPath: "n", autoIncrement: true });
      }
      // Versión 2: la clave del diario (T65).
      if (e.oldVersion < 2) p.result.createObjectStore("claves", { keyPath: "id" });
    };
    p.onsuccess = () => {
      // Si otra parte de la app pide borrar o migrar la base, esta conexión se cierra para no trabarla.
      p.result.onversionchange = () => p.result.close();
      ok(p.result);
    };
    p.onerror = () => mal(p.error);
  });
  return {
    todos: async <T>(store: Store) => {
      const pedido = (await base).transaction(store).objectStore(store).getAll();
      return new Promise<T[]>((ok, mal) => {
        pedido.onsuccess = () => ok(pedido.result as T[]);
        pedido.onerror = () => mal(pedido.error);
      });
    },
    aplicar: async (poner, quitar = []) => {
      const t = (await base).transaction(["documentos", "cola", "claves"], "readwrite");
      for (const [store, valor] of poner) t.objectStore(store).put(valor);
      for (const [store, clave] of quitar) t.objectStore(store).delete(clave);
      return new Promise<void>((ok, mal) => {
        t.oncomplete = () => ok();
        t.onerror = t.onabort = () => mal(t.error);
      });
    },
  };
}

// Borra todo lo de una cuenta en este dispositivo (después de que el servidor confirmó el borrado, DR44).
export const borrarAlmacen = (email: string) =>
  new Promise<void>((ok) => {
    const p = indexedDB.deleteDatabase(`dhlab:${email}`);
    p.onsuccess = p.onerror = () => ok();
  });

// La carta guardada son los datos de nacimiento, el instante elegido y su rango de incertidumbre, no la carta calculada:
// la app la recalcula (R2). La versión de la tzdb con la que se convirtió la hora queda registrada.
export const ID_CARTA = "principal";
export interface CartaGuardada { esquema: 1; nacimiento: Nacimiento; instante: string; inicio: string; fin: string; tzdb: string }
export const contenidoCarta = (nacimiento: Nacimiento, { centro, inicio, fin }: { centro: Date; inicio: Date; fin: Date }, tzdb: string): CartaGuardada => ({
  esquema: 1,
  nacimiento,
  instante: centro.toISOString(),
  inicio: inicio.toISOString(),
  fin: fin.toISOString(),
  tzdb,
});
