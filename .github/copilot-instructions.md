# Instrucciones para el asistente

Antes de tocar la web, lee `DESIGN.md` (reglas de diseño, movimiento y velocidad) y `PRODUCT.md` (qué es la app y para quién). Mandan sobre cualquier costumbre general.

- El código fuente está en `pwa/`; la web publicada es la raíz del repositorio. Cómo compilar y publicar: `pwa/README.md`.
- Interfaz en gallego por defecto y en español: todo texto nuevo va en los dos idiomas, `tr('galego','español')`.
- Nada hace esperar: ninguna animación retrasa el contenido ni bloquea un toque o una tecla. Con el teclado no se anima nada. Con «reducir movimiento» nada se desliza.
- Las pruebas de `probas/` deben pasar (`cd probas && npm ci && npx playwright test`, y `-c webkit.config.mjs` para Safari).
- No escribas datos personales reales (nombres, correos) en pruebas ni ejemplos: usa nombres inventados.
