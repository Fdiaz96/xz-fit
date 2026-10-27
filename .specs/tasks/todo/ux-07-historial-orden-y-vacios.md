# UX 7: Historial ordenado por entreno y con vacíos útiles

Reglas comunes en `ux-00-indice.md`. Prioridad media.

## Problema
- Historial arranca con "Dolor por zona" (un selector y "Sin registros todavía."). Después vienen "Peso por ejercicio" y "Sesiones". Para quien entrena, lo primero debería ser su progreso.
- Los estados vacíos solo informan ("Después de tus primeros entrenos vas a ver el progreso acá.", "Todavía no hay sesiones."). No invitan a hacer nada.

## Dónde
- `app.js`, en `renderHistory`, cerca de la línea 833. La sección de dolor está cerca de la línea 839.

## Propuesta
- Orden: Sesiones (o un resumen de la semana), después Peso por ejercicio y al final Dolor por zona.
- Dolor por zona se muestra solo si hay zonas o registros de dolor.
- Sin sesiones, un solo estado vacío arriba: "Todavía no entrenaste. Tu progreso aparece acá después del primer entreno." con un botón "Empezar Día A" que use el día que toca (`data-action="start-workout"`).
- No repetir dos vacíos seguidos que dicen lo mismo.

## Criterios de aceptación
- Usuario nuevo: un estado vacío con botón que arranca el entreno del día.
- Usuario con sesiones: el progreso de entreno está arriba y el dolor abajo (o no aparece).
- e2e en verde.
