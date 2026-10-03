// Servidor de cuentas simulado para las páginas de desarrollo:
// no@ejemplo.com no está invitado, lento@ejemplo.com falla el envío, y el código correcto es 123456.
import type { CuentaApi } from "../src/cuenta-api";

const pausa = () => new Promise((r) => setTimeout(r, 500));
let intentos = 5;
export const simulada: CuentaApi = {
  async pedirAcceso(email) {
    await pausa();
    if (email.startsWith("no@")) return { error: "no_invitado" };
    if (email.startsWith("lento@")) return { error: "envio_fallido" };
    intentos = 5;
    return { ok: true, reenviarEn: 15 };
  },
  async verificar(email, codigo) {
    await pausa();
    if (codigo === "123456") return { cuenta: { email, modo: "nube" } };
    if (codigo === "999999") return { error: "codigo_vencido" };
    intentos -= 1;
    return intentos > 0 ? { error: "codigo_incorrecto", quedan: intentos } : { error: "intentos_agotados" };
  },
  salir: async () => ({ ok: true }),
  borrar: async () => ({ ok: true }),
};
