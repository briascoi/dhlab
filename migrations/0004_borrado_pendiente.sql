-- Reemplazo de la clave del diario (T79, E4-limpieza). Solo aditiva.
-- "Empezar un diario nuevo" anota acá la clave reemplazada en la misma transacción que la cambia;
-- las entradas cifradas con esa clave se borran en un paso aparte, que cualquier pedido posterior de la cuenta completa.
CREATE TABLE borrados_pendientes (
  cuenta_id TEXT NOT NULL REFERENCES cuentas (id) ON DELETE CASCADE,
  id_clave TEXT NOT NULL,
  PRIMARY KEY (cuenta_id, id_clave)
);
