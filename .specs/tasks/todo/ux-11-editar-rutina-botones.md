# UX 11: editar rutina con controles claros

Reglas comunes en `ux-00-indice.md`. Prioridad baja.

## Problema
- En Entreno → "Editar rutina", cada ejercicio tiene cuatro botones de ícono en una grilla de 2×2: ↑, ↓, ⇄ (cambiar) y ✕ (quitar). Son chicos, están pegados y no tienen texto. Es fácil tocar ✕ queriendo tocar ⇄.
- "Volver al plan original" va en rojo justo debajo de "+ Agregar ejercicio", sin separación.

## Dónde
- `app.js`, en `renderTrain`, cerca de la línea 292 (`.tools` con `routine-move`, `routine-pick`, `routine-del`) y de la 299 (`routine-reset`).
- Acciones: `routine-move` (línea ~1155) y `routine-reset` (línea ~1159, ya pide confirmación).

## Propuesta
- Por ejercicio: "Cambiar" como botón con texto, y un menú o bloque con "Subir", "Bajar" y "Quitar". Como alternativa, ↑/↓ quedan como íconos y "Cambiar" y "Quitar" pasan a texto. Áreas táctiles de al menos 44 px.
- Quitar sigue siendo inmediato con "Deshacer" en el aviso, si ya existe ese patrón (`toast(msg, undo)`). Si no, que pida confirmación.
- "Volver al plan original" va al final, separado por espacio, como link discreto. Mantené la confirmación.

## Criterios de aceptación
- Cada acción por ejercicio se entiende sin adivinar el ícono.
- La acción destructiva global queda separada de agregar ejercicio.
- e2e en verde: hay casos que usan estos `data-action`; mantené los atributos.
