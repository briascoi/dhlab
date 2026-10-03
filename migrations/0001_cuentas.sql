-- Capa de cuentas (T63). Las migraciones son solo aditivas (T30).
CREATE TABLE invitaciones (
  email TEXT PRIMARY KEY,
  creada INTEGER NOT NULL
);

CREATE TABLE cuentas (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  modo TEXT NOT NULL CHECK (modo IN ('nube', 'local')),
  creada INTEGER NOT NULL
);

-- Un solo código de acceso vigente por email; se guarda su hash, nunca el código.
CREATE TABLE codigos (
  email TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  vence INTEGER NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  id_pedido TEXT NOT NULL,
  modo TEXT NOT NULL CHECK (modo IN ('nube', 'local')),
  creado INTEGER NOT NULL
);

-- Envíos de código, para los topes por email y por IP.
CREATE TABLE envios (
  clave TEXT NOT NULL,
  momento INTEGER NOT NULL
);
CREATE INDEX envios_clave ON envios (clave, momento);

-- De la sesión se guarda solo el hash de su id.
CREATE TABLE sesiones (
  hash TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
  vence INTEGER NOT NULL
);
