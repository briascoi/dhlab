-- Clave del diario (T65). Solo aditiva. El servidor guarda la clave envuelta con el código de recuperación: no puede abrirla.
-- Una sola clave vigente por cuenta: la primera que se registra gana (E3-dosclaves).
CREATE TABLE claves (
  cuenta_id TEXT PRIMARY KEY REFERENCES cuentas (id) ON DELETE CASCADE,
  id_clave TEXT NOT NULL,
  envuelta TEXT NOT NULL,
  revision INTEGER NOT NULL,
  creada INTEGER NOT NULL
);

-- Cada entrada del diario lleva el id de la clave con la que se cifró; carta y libro quedan sin valor.
ALTER TABLE documentos ADD COLUMN id_clave TEXT;
