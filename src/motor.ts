// El motor (Swiss Ephemeris en WASM y la tabla de husos) se carga con import() recién cuando hace falta calcular (T68).
export const motor = async () => {
  const [carta, efemerides, intervalo, nacimiento, hora] = await Promise.all([
    import("./engine/carta"),
    import("./engine/efemerides"),
    import("./engine/interval"),
    import("./engine/nacimiento"),
    import("./engine/time"),
  ]);
  await efemerides.iniciar();
  return { ...carta, ...intervalo, ...nacimiento, VERSION_TZDB: hora.VERSION_TZDB };
};
