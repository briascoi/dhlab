-- Gasto de la IA incluida (T54, CEO2-A2). Solo aditiva.
-- Una fila por cuenta y por mes, y una fila 'global' por mes: los dos topes se comprueban y se reservan en una sola sentencia.
-- `micros` son millonésimas de dólar.
CREATE TABLE gasto_ia (
  clave TEXT NOT NULL,
  mes TEXT NOT NULL,
  micros INTEGER NOT NULL,
  PRIMARY KEY (clave, mes)
);
