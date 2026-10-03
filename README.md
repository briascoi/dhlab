# DH Lab

Laboratorio de Diseño Humano: calcula tu carta, la muestra como una consola que puedes tocar y la guarda en tu cuenta. Está en [dhlab.app](https://dhlab.app).

El código es abierto, con licencia [AGPL-3.0](LICENSE), porque el cálculo usa Swiss Ephemeris. Los créditos completos están en [dhlab.app/creditos](https://dhlab.app/creditos/).

## Cómo está hecho

- **App** (`src/`): TypeScript sin framework, con Vite. El motor (`src/engine/`) calcula la carta en el navegador con Swiss Ephemeris en WebAssembly; no depende de la interfaz.
- **Servidor** (`worker/`): un Worker de Cloudflare con una base D1 para cuentas por invitación y documentos. El diario viaja cifrado desde el dispositivo.
- **Diseño**: `DESIGN.md`.
- **Qué sabemos del sistema y de dónde sale**: `docs/diseno-humano/base-de-conocimiento.md`.

## Probarla en local

```bash
npm install
npx wrangler d1 migrations apply dhlab --local
npx wrangler d1 execute dhlab --local --command "INSERT OR IGNORE INTO invitaciones (email, creada) VALUES ('tu@email', 0)"
cp .dev.vars.example .dev.vars
npx wrangler dev --port 8788
npm run dev -- --port 5199
```

Abrir `http://localhost:5199/`. El código de acceso sale en la consola de `wrangler dev`, no por email.

## Tests

- `npm test`: tests unitarios y de integración. El motor corre en Chromium, y se valida contra 26 cartas públicas y contra una segunda fuente de la tabla del sistema.
- `npm run e2e`: recorrido completo con Playwright y axe.
- `npm run build`: lo que se publica.
