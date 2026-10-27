# UX 10: pesos con unidad y coherentes entre inicio y Entreno

Reglas comunes en `ux-00-indice.md`. Prioridad baja. Coordiná el término con la tarea 5 si ya está hecha.

## Problema
- En la pestaña Entreno, cada ejercicio muestra un número grande ("14") con "a calibrar" abajo y sin "kg". Cuando no está calibrando, la unidad sí aparece. Sin unidad, el número puede leerse como reps.
- En el inicio, el mismo ejercicio muestra solo "a calibrar", sin el número. Las dos pantallas no coinciden.

## Dónde
- Entreno: `app.js`, en `renderTrain`, cerca de la línea 293: `<span class="num">${p.w || '—'}</span><span class="unit">${p.calib ? 'a calibrar' : 'kg'}</span>`.
- Inicio: `renderHome`, cerca de la línea 248 (`load`).

## Propuesta
- Entreno: el número siempre lleva "kg". La calibración va como etiqueta aparte, por ejemplo "14 kg" y debajo "calibración".
- Inicio: mostrar el peso sugerido con el mismo formato ("14 kg · calibración" no; usá dos líneas o una etiqueta, sin punto medio).

## Criterios de aceptación
- Ningún peso aparece sin unidad.
- Inicio y Entreno muestran lo mismo para el mismo ejercicio.
- e2e en verde.
