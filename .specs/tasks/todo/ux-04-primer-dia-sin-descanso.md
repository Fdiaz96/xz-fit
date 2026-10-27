# UX 4: el primer día no recibe al usuario con "día de descanso"

Reglas comunes en `ux-00-indice.md`. Prioridad alta.

## Problema
Si el usuario termina el alta un día que no marcó como de entreno, el inicio dice "Hoy es día de descanso, podés entrenar igual". Recién configuró todo para entrenar y lo primero que lee es que hoy no toca. Desanima.

## Dónde
- `app.js`, en `renderHome`, cerca de la línea 247: `const dayMsg = doneToday ? '✓ Entreno de hoy hecho' : trainDay ? 'Hoy toca entrenar' : 'Hoy es día de descanso, podés entrenar igual';`.
- `last` (el último entreno) ya existe ahí: sin entrenos previos, la línea de arriba dice "Primer entreno".

## Propuesta
- Sin ningún entreno guardado, el mensaje es positivo y va con el acento (clase `.on` de `.today`): "Tu primer entreno. Calibramos tus pesos: tarda unos 40 minutos." Calculá la duración real o sacala si no hay dato confiable.
- Con entrenos previos, se mantienen los mensajes actuales.
- Hay que evitar que el mismo mensaje se repita en `plan-line` ("Primer entreno") y en `day-msg`. Unificá.

## Criterios de aceptación
- Usuario recién dado de alta en un día sin entreno: no aparece la palabra "descanso".
- Después del primer entreno guardado, vuelven los mensajes normales.
- e2e: agregá un caso para el mensaje del primer día.
