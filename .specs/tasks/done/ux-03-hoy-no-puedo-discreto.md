# UX 3: "Hoy no puedo" como acción secundaria

Reglas comunes en `ux-00-indice.md`. Prioridad alta.

## Problema
En la sesión de entreno, debajo del nombre de cada ejercicio aparece "Hoy no puedo" en verde lima y negrita (rojo/naranja en los adaptados por dolor). El lima es el color de la acción principal ("Empezar", ✓), así que el link de saltear el ejercicio compite con lo que el usuario sí tiene que hacer.

## Dónde
- `app.js`, en `renderWorkout`, cerca de la línea 473: la cabecera `.info` de cada ejercicio, con el botón que abre `swapsheet` (línea ~504: "Hoy no puedo: el ejercicio se cambia solo en esta sesión…").
- Estilos del link en `styles.css`.

## Propuesta
- Link gris (`--muted`), peso normal y tamaño chico. Que se lea "Hoy no puedo, cambiar" o "Cambiar por hoy" para que se entienda qué hace.
- Ubicación: alineado a la derecha de la fila de "Cómo se hace", o como ícono más texto chico. Que no quede debajo del título, donde se lee como subtítulo.
- Área táctil de al menos 44 px de alto.

## Criterios de aceptación
- En la captura, la acción más visible de cada tarjeta es la serie a cargar, no "Hoy no puedo".
- Sigue abriendo `swapsheet` con las mismas opciones. Los selectores de e2e que la usan siguen andando.
- e2e en verde.
