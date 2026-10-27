# UX 5: explicar "al 60 %" y "a calibrar"

Reglas comunes en `ux-00-indice.md`. Prioridad alta. Hacela después de la tarea 1.

## Problema
- "al 60 %" aparece en naranja junto al nombre del ejercicio (inicio, Entreno, sesión) sin decir por qué. El usuario no sabe que es por su dolor de codo ni 60 % de qué.
- "a calibrar" aparece en el inicio en lugar del peso, y en Entreno debajo de un número sin unidad. No explica qué significa.
- En la sesión, la nota "Modo dolor (Codo lateral): al 60 % → 6 kg." es jerga.

## Dónde
- Inicio: `app.js`, en `renderHome`, cerca de la línea 248 (`load`, "a calibrar") y la 253 (`<em>` con 'variante amable' / 'al 60 %').
- Entreno: `renderTrain`, cerca de las líneas 291 y 293.
- Sesión: `renderWorkout`, cerca de la línea 456 (`note pain`).

## Propuesta
- En listas (inicio y Entreno), cambiar "al 60 %" por "más liviano por tu codo" (con el nombre de la zona, en minúscula). Cambiar "variante amable" por "variante por tu codo".
- En la sesión, la nota dice: "Más liviano por tu codo: 6 kg en vez de 10 kg." Mostrá el peso sin el recorte si está disponible.
- "a calibrar" pasa a "primera vez" o "calibración", el mismo término que en la tarea 1. Al tocar el ejercicio, el detalle (`exsheet`) explica en una línea qué es calibrar.

## Criterios de aceptación
- Ninguna pantalla muestra "al 60 %" sin decir la zona.
- Inicio, Entreno y sesión usan el mismo término para la calibración.
- e2e en verde: hay casos que buscan "al 60 %" o "variante amable", actualizalos.
