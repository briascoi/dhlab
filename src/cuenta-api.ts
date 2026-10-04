// Cliente de la capa de cuentas (/v1/cuenta). La interfaz existe para poder probar las pantallas con respuestas simuladas.
export type Modo = "nube" | "local";
export type Fallo = { error: string; espera?: number; quedan?: number };
export type Cuenta = { email: string; modo: Modo };

export interface CuentaApi {
  pedirAcceso(email: string, modo: Modo, idPedido: string): Promise<{ ok: true; reenviarEn: number } | Fallo>;
  verificar(email: string, codigo: string): Promise<{ cuenta: Cuenta } | Fallo>;
  // A "local", el servidor borra su copia; a "nube", solo cambia el modo y el contenido sube después.
  cambiarModo(modo: Modo): Promise<{ cuenta: Cuenta } | Fallo>;
  salir(): Promise<{ ok: true } | Fallo>;
  borrar(): Promise<{ ok: true } | Fallo>;
}

async function enviar<T>(ruta: string, cuerpo?: object, method?: string): Promise<T | Fallo> {
  try {
    const init = cuerpo || method ? { method: method ?? "POST", headers: { "Content-Type": "application/json" }, body: cuerpo && JSON.stringify(cuerpo) } : undefined;
    return (await (await fetch(ruta, init)).json()) as T | Fallo;
  } catch {
    return { error: "sin_red" };
  }
}

export const api: CuentaApi = {
  pedirAcceso: (email, modo, idPedido) => enviar("/v1/cuenta/acceso", { email, modo, idPedido }),
  verificar: (email, codigo) => enviar("/v1/cuenta/verificar", { email, codigo }),
  cambiarModo: (modo) => enviar("/v1/cuenta/modo", { modo }),
  salir: () => enviar("/v1/cuenta/salir", undefined, "POST"),
  borrar: () => enviar("/v1/cuenta", undefined, "DELETE"),
};

// Cliente de los documentos de la cuenta (/v1/documentos): carta, libro y diario, con versión por documento (T64).
export type Tipo = "carta" | "libro" | "diario";
export interface Documento { tipo: Tipo; id: string; contenido: string; cifrado: boolean; version: number }
export interface Cambio { contenido: string; cifrado: boolean; versionBase: number; idOperacion: string }

export interface DocumentosApi {
  listar(): Promise<{ documentos: Documento[] } | Fallo>;
  guardar(tipo: Tipo, id: string, cambio: Cambio): Promise<{ documento: Documento } | (Fallo & { actual?: Documento | null })>;
}

export const documentosApi: DocumentosApi = {
  listar: () => enviar("/v1/documentos"),
  guardar: (tipo, id, cambio) => enviar(`/v1/documentos/${tipo}/${id}`, cambio, "PUT"),
};

// Cliente de la clave del diario (/v1/clave): el servidor guarda solo la clave envuelta (T65).
export interface ClaveGuardada { idClave: string; envuelta: string; revision: number }
export interface ClaveApi {
  leer(): Promise<{ clave: ClaveGuardada | null } | Fallo>;
  // `reemplaza`: el id de la clave vigente que se cambia por esta ("Empezar un diario nuevo", DR32).
  guardar(cambio: { idClave: string; envuelta: string; revisionBase: number; reemplaza?: string }): Promise<{ clave: ClaveGuardada } | (Fallo & { actual?: ClaveGuardada | null })>;
}

export const claveApi: ClaveApi = {
  leer: () => enviar("/v1/clave"),
  guardar: (cambio) => enviar("/v1/clave", cambio, "PUT"),
};
