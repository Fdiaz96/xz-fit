# UX 1: la calibración se explica una sola vez en la sesión

Reglas comunes en `ux-00-indice.md`. Prioridad alta.

## Problema
En el primer entreno (sesión `#wsheet`), cada ejercicio con peso muestra casi el mismo párrafo: "Serie de calibración: con 14 kg hacé reps hasta que sientas que te salen solo 2 más, y frená ahí (es RIR 2). Anotá las reps y el RIR: con eso calculamos tu peso real." Con 6 ejercicios, la sesión mide unos 3.000 px y las series quedan enterradas entre notas iguales.

## Dónde
- `app.js`, en `renderWorkout`, cerca de la línea 455: `if (it.calib) notes.push('<div class="note acc">Serie de calibración: …')`.
- La explicación del RIR (v1.18.1) se abre sola en el primer ejercicio con peso. Revisá que no se pise con lo nuevo.

## Propuesta
- Arriba de la lista de ejercicios, solo si algún ejercicio está en calibración, va un bloque único: "Hoy calibramos tus pesos. En cada ejercicio con la etiqueta *calibración*, hacé reps hasta que te queden 2 en reserva y frená. Con eso calculamos tu peso de trabajo."
- En cada ejercicio, el párrafo se reemplaza por una etiqueta corta "calibración" junto al peso sugerido.
- Si se calibra un solo ejercicio (por ejemplo, uno nuevo agregado más adelante), puede seguir teniendo la nota completa en su tarjeta.

## Criterios de aceptación
- Con 2 o más ejercicios en calibración, la explicación aparece una vez, no por ejercicio.
- Cada ejercicio en calibración se distingue visualmente (etiqueta) sin repetir el texto.
- La sesión del primer entreno es claramente más corta. Medí la altura antes y después con Playwright.
- e2e en verde: hay casos que buscan la nota de calibración, ajustalos si hace falta.
