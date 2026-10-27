# UX 8: zonas con dolor con el mismo componente que el alta

Reglas comunes en `ux-00-indice.md`. Prioridad media. Si ya está hecha la tarea 6, la vista se llama "Dolor".

## Problema
En el alta (v1.19.0), las zonas son una lista de casillas (`tile`, borde naranja y tilde) y el detalle se abre debajo de la zona marcada (`.zone-detail`). En la pestaña Tendones, las mismas zonas son tarjetas grandes con interruptor. Es otro componente para la misma acción, y con 6 zonas la vista se hace larga.

## Dónde
- `app.js`, en `renderTendons`, cerca de la línea 781.
- Componentes del alta: `tile()` (junto a `equipFields`) y el paso 3 de `renderOnb`, con `.tiles.list` y `.zone-detail` en `styles.css`.
- La acción `zone-toggle` (cerca de la línea 1178) pide confirmación fuera del alta al quitar una zona. Mantenelo.

## Propuesta
- Usar `tile()` y `.tiles.list` en Tendones. La zona marcada despliega debajo su contenido actual: lado, fase, ejercicio y avance de fase.
- Las zonas sin marcar quedan como filas compactas.

## Criterios de aceptación
- Alta y Tendones se ven y se usan igual para marcar una zona.
- Quitar una zona en Tendones sigue pidiendo confirmación.
- e2e en verde: hay casos con `[data-action="zone-toggle"]` en `#view-tendons`; verificá que `page.check` siga funcionando.
