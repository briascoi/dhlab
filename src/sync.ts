// Sincronización de los documentos de la cuenta (T64, cliente): copia local y cola por cuenta.
// No importa nada del motor, de la interfaz ni del navegador: el almacén real está en `almacen.ts`.
import type { Documento, DocumentosApi, Modo, Tipo } from "./cuenta-api";

// version: la última que confirmó el servidor (0 si nunca subió).
// rechazado: lo que el servidor no aceptó por un conflicto; `contenido` pasa a ser lo que hay en el servidor (E3-tipos).
// sinSubir: el servidor no la aceptó porque se cifró con una clave que ya no es la vigente; queda en el dispositivo (E4-reemplazo).
// borrado: la persona lo borró acá y falta borrarlo en el servidor; ya no se muestra.
export interface Local extends Documento { clave: string; rechazado?: string; sinSubir?: boolean; borrado?: boolean }
export interface Operacion { n?: number; clave: string; contenido: string; cifrado: boolean; idOperacion: string; borrar?: boolean }

export type Store = "documentos" | "cola" | "claves";
// `todos("cola")` devuelve de la más vieja a la más nueva; `aplicar` es una sola transacción.
export interface Almacen {
  todos<T>(store: Store): Promise<T[]>;
  aplicar(poner: [Store, object][], quitar?: [Store, number | string][]): Promise<void>;
}

export function crearSync(almacen: Almacen, api: DocumentosApi, modo: Modo) {
  const claveDe = (tipo: Tipo, id: string) => `${tipo}/${id}`;
  const crudo = async (tipo: Tipo, id: string) => (await almacen.todos<Local>("documentos")).find((d) => d.clave === claveDe(tipo, id));
  // Lo borrado que todavía espera su turno en la cola ya no existe para la app.
  const leer = async (tipo: Tipo, id: string) => {
    const d = await crudo(tipo, id);
    return d?.borrado ? undefined : d;
  };

  // Las lecturas seguidas de escritura en el almacén van de a una; los pedidos de red quedan afuera, así guardar no espera a la red.
  let turno: Promise<unknown> = Promise.resolve();
  const enTurno = <T>(hacer: () => Promise<T>): Promise<T> => {
    const r = turno.then(hacer, hacer);
    turno = r.catch(() => undefined);
    return r;
  };

  // `comoNuevo`: el servidor ya no tiene este documento (su clave se reemplazó), así que sube sin versión base.
  const guardar = (tipo: Tipo, id: string, contenido: string, cifrado = false, comoNuevo = false) =>
    enTurno(async () => {
      const previo = await crudo(tipo, id);
      if (previo?.contenido === contenido && previo.rechazado === undefined && !previo.sinSubir && !previo.borrado) return;
      const clave = claveDe(tipo, id);
      const poner: [Store, object][] = [["documentos", { clave, tipo, id, contenido, cifrado, version: comoNuevo ? 0 : (previo?.version ?? 0) } satisfies Local]];
      // El id de operación nace al encolar y queda guardado: un reintento lleva el mismo (Codex #4).
      // Una cuenta "solo en este dispositivo" no encola nada (invariante 2).
      // Quedarse con lo del servidor tras un rechazo tampoco: solo se quita la marca, no hay nada que subir.
      const aceptaServidor = previo?.contenido === contenido && previo.rechazado !== undefined && !previo.sinSubir;
      if (modo === "nube" && !aceptaServidor) poner.push(["cola", { clave, contenido, cifrado, idOperacion: crypto.randomUUID() } satisfies Operacion]);
      await almacen.aplicar(poner);
    });

  // Quita documentos solo de este dispositivo, con lo que tuvieran en la cola; no borra nada del servidor.
  const olvidar = (tipo: Tipo, ids: string[]) =>
    enTurno(async () => {
      const claves = new Set(ids.map((id) => claveDe(tipo, id)));
      const cola = (await almacen.todos<Operacion>("cola")).filter((o) => claves.has(o.clave));
      await almacen.aplicar([], [...[...claves].map((c): [Store, string] => ["documentos", c]), ...cola.map((o): [Store, number] => ["cola", o.n!])]);
    });

  // La cuenta pasó de solo local a la nube: el servidor no tiene nada, así que todo lo de este dispositivo sube como nuevo (DR39, E4-otrosdisp).
  // ponytail: si se repite después de una subida parcial, lo ya subido choca con su propia copia; el choque de la carta con contenido igual se resuelve solo.
  const subirTodo = () =>
    enTurno(async () => {
      const cola = await almacen.todos<Operacion>("cola");
      const poner = (await almacen.todos<Local>("documentos")).flatMap(({ rechazado: _r, sinSubir: _s, ...d }): [Store, object][] => [
        ["documentos", { ...d, version: 0 } satisfies Local],
        ["cola", { clave: d.clave, contenido: d.contenido, cifrado: d.cifrado, idOperacion: crypto.randomUUID() } satisfies Operacion],
      ]);
      await almacen.aplicar(poner, cola.map((o) => ["cola", o.n!]));
    });

  // Deja una propuesta junto a un documento que ya existe, sin tocarlo ni subir nada: la persona elige después (carta importada, DR38).
  const proponer = (tipo: Tipo, id: string, contenido: string) =>
    enTurno(async () => {
      const previo = await leer(tipo, id);
      if (previo) await almacen.aplicar([["documentos", { ...previo, rechazado: contenido } satisfies Local]]);
    });

  const listar = async (tipo: Tipo) => (await almacen.todos<Local>("documentos")).filter((d) => d.tipo === tipo && !d.borrado);

  // Borra un documento: de este dispositivo ya, y del servidor en la próxima sincronización. Lo que nunca subió no deja nada pendiente.
  const borrar = (tipo: Tipo, id: string) =>
    enTurno(async () => {
      const previo = await crudo(tipo, id);
      if (!previo) return;
      const cola = (await almacen.todos<Operacion>("cola")).filter((o) => o.clave === previo.clave).map((o): [Store, number] => ["cola", o.n!]);
      if (modo !== "nube" || previo.version === 0) return almacen.aplicar([], [["documentos", previo.clave], ...cola]);
      await almacen.aplicar([["documentos", { ...previo, borrado: true } satisfies Local], ["cola", { clave: previo.clave, contenido: "", cifrado: false, idOperacion: crypto.randomUUID(), borrar: true } satisfies Operacion]], cola);
    });

  // Sube la cola de a una operación, la más vieja primero. Devuelve "al_dia" o el error que la frenó; frenada, la cola queda intacta.
  async function vaciar(): Promise<string> {
    let diarioCerrado = false;
    for (;;) {
      const [op] = await almacen.todos<Operacion>("cola");
      if (!op) return diarioCerrado ? "clave_reemplazada" : "al_dia";
      const doc = (await almacen.todos<Local>("documentos")).find((d) => d.clave === op.clave)!;
      if (op.borrar) {
        const b = await api.borrar(doc.tipo, doc.id, { versionBase: doc.version, idOperacion: op.idOperacion });
        if (!("ok" in b) && b.error !== "conflicto") return b.error;
        // Borrado en el servidor: se va de acá. Si otro dispositivo lo cambió antes, no se borra: vuelve a la vista con lo del servidor.
        const actual = "actual" in b ? b.actual : null;
        await enTurno(() => almacen.aplicar("ok" in b || !actual ? [] : [["documentos", { ...actual, clave: doc.clave } satisfies Local]], [["cola", op.n!], ...("ok" in b || !actual ? [["documentos", doc.clave] as [Store, string]] : [])]));
        continue;
      }
      const r = await api.guardar(doc.tipo, doc.id, { contenido: op.contenido, cifrado: op.cifrado, versionBase: doc.version, idOperacion: op.idOperacion });
      if (!("documento" in r) && r.error !== "conflicto" && r.error !== "clave_reemplazada") return r.error;
      await enTurno(async () => {
        const actual = (await leer(doc.tipo, doc.id))!;
        // La clave del diario ya no es la vigente: la entrada queda en el dispositivo hasta que se abra el diario con el código nuevo,
        // y sale de la cola para no frenar a la carta ni al libro.
        if (!("documento" in r) && r.error === "clave_reemplazada") {
          diarioCerrado = true;
          const cola = (await almacen.todos<Operacion>("cola")).filter((o) => o.clave === op.clave);
          return almacen.aplicar([["documentos", { ...actual, sinSubir: true }]], cola.map((o) => ["cola", o.n!]));
        }
        if ("documento" in r) return almacen.aplicar([["documentos", { ...actual, version: r.documento.version }]], [["cola", op.n!]]);
        // Versión vieja: lo local pasa a ser lo del servidor, lo propio queda en `rechazado` para confirmarlo otra vez,
        // y se descarta lo que seguía en la cola para ese documento, que se había escrito sobre la versión vieja.
        const cola = (await almacen.todos<Operacion>("cola")).filter((o) => o.clave === op.clave);
        const servidor = "actual" in r && r.actual ? r.actual : { version: 0 };
        return almacen.aplicar([["documentos", { ...actual, ...servidor, rechazado: actual.contenido }]], cola.map((o) => ["cola", o.n!]));
      });
    }
  }

  let enCurso: Promise<string> | null = null;
  // Primero sube lo propio y después baja: un reintento de una respuesta perdida tiene que llegar con su versión base original.
  const sincronizar = (): Promise<string> =>
    (enCurso ??= (async () => {
      if (modo !== "nube") return "al_dia";
      const estado = await vaciar();
      if (estado !== "al_dia" && estado !== "clave_reemplazada") return estado;
      const r = await api.listar();
      if (!("documentos" in r)) return r.error;
      await enTurno(async () => {
        // Lo que se guardó mientras se bajaba no se pisa: sube en la próxima vuelta.
        const pendientes = new Set((await almacen.todos<Operacion>("cola")).map((o) => o.clave));
        const locales = new Map((await almacen.todos<Local>("documentos")).map((d) => [d.clave, d]));
        const nuevos = r.documentos
          .map((d) => ({ ...locales.get(claveDe(d.tipo, d.id)), ...d, clave: claveDe(d.tipo, d.id) }))
          .filter((d) => !pendientes.has(d.clave) && locales.get(d.clave)?.version !== d.version);
        await almacen.aplicar(nuevos.map((d) => ["documentos", d]));
      });
      return estado;
    })().finally(() => (enCurso = null)));

  // Cuántos cambios esperan para subir (DR36).
  const pendientes = async () => (await almacen.todos<Operacion>("cola")).length;
  return { guardar, leer, listar, borrar, olvidar, proponer, subirTodo, sincronizar, pendientes };
}
