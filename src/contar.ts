// Contadores de uso: avisa al servidor que pasó algo, sin decir quién. Si falla, no importa: nunca frena a la app.
export type Evento = "carta_calculada" | "cuenta_pedida" | "capitulo_elegido" | "entrada_escrita" | "diario_cerrado" | "capitulo_escrito" | "capitulo_cortado" | "coach_mensaje";
export const contar = (nombre: Evento) => void fetch("/v1/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }), keepalive: true }).catch(() => undefined);
