# UX 9: el botón de fase invita a avanzar solo cuando corresponde

Reglas comunes en `ux-00-indice.md`. Prioridad media.

## Problema
En Tendones, cada zona tiene un botón grande "Fase 2 →" aunque recién empezó la fase. Abajo, en texto tenue: "Para avanzar: 10 días en la fase y una semana con dolor ≤ 3 sin empeorar." El botón invita a saltear el protocolo.

## Dónde
- `app.js`, en `renderTendons`, cerca de las líneas 796–797: botones `data-action="phase"` con `data-dir`, y `phaseReady(S, zoneId, today())`.

## Propuesta
- Si `phaseReady` es falso, se muestra el progreso hacia el avance: "Día 3 de 10 en esta fase" y el estado del dolor de la semana. Avanzar queda como link chico gris ("Avanzar igual"), con confirmación que explique el riesgo.
- Si `phaseReady` es verdadero, un botón destacado naranja "Pasar a fase 2: isotónicos lentos" con una línea de qué cambia.
- Volver de fase ("← Fase 1") queda como link secundario.

## Criterios de aceptación
- Antes de cumplir el criterio no hay un botón destacado para avanzar.
- Al cumplirlo, el avance es la acción principal de la tarjeta.
- e2e en verde: los casos de fase usan `data-action="phase"`; si agregás confirmación, aceptala en la prueba.
