# UX 2: el campo de reps no parece cargado

Reglas comunes en `ux-00-indice.md`. Prioridad alta.

## Problema
En la sesión de entreno, el campo de reps de cada serie muestra como placeholder el centro del rango ("9" para 6–12), en la misma fuente grande y negrita que el peso. Solo se diferencia por un gris apenas más tenue, así que parece un valor ya anotado. Con segundos pasa lo mismo ("30" en la plancha).

## Dónde
- `app.js`, en `renderWorkout`, cerca de la línea 467: `<input type="number" … placeholder="${hasRepRange(it.ex) ? repCenter(it.range) : it.secs}" …>`.
- Estilos de la grilla de series en `styles.css` (buscá las clases del input de reps y `::placeholder`).
- Hay que entender qué pasa al tocar ✓ con el campo vacío: ¿se usa el placeholder como valor? Si se usa, mantené ese comportamiento y dejalo claro en la UI.

## Propuesta
- El placeholder pasa a verse claramente como sugerencia: más chico, sin negrita y en `--faint`. Por ejemplo "9?" o "≈9", o vacío con un "meta 6–12" arriba de la columna.
- Si ✓ con el campo vacío toma el placeholder, que después de marcar se vea el valor real cargado, con su estilo normal.

## Criterios de aceptación
- En una captura a 390 px, una serie sin cargar se distingue a simple vista de una cargada.
- No cambia la lógica de guardado. Si cambia, que sea a propósito y con prueba.
- e2e en verde.
