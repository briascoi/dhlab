-- Documentos de cada cuenta (T64): carta, libro y diario en una sola tabla. Solo aditiva.
CREATE TABLE documentos (
  cuenta_id TEXT NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('carta', 'libro', 'diario')),
  id TEXT NOT NULL,
  contenido TEXT NOT NULL,
  cifrado INTEGER NOT NULL CHECK (cifrado IN (0, 1)),
  version INTEGER NOT NULL,
  id_operacion TEXT NOT NULL,
  actualizado INTEGER NOT NULL,
  PRIMARY KEY (cuenta_id, tipo, id),
  -- El diario solo se guarda cifrado en el dispositivo (CEO2-S3a).
  CHECK (tipo <> 'diario' OR cifrado = 1)
);
