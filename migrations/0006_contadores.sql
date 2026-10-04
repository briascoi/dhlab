-- Contadores de uso (T67, primera parte). Solo aditiva.
-- Cuántas veces pasó cada cosa por día, sin cuenta, sin identificador y sin texto: no se puede saber quién fue.
CREATE TABLE contadores (
  nombre TEXT NOT NULL,
  dia TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (nombre, dia)
);
