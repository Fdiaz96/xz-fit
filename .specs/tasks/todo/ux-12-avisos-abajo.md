# UX 12: los avisos no tapan el encabezado

Reglas comunes en `ux-00-indice.md`. Prioridad baja.

## Problema
Los avisos (`#toast`), como "Modo dolor activado.", aparecen arriba y tapan el saludo y la fecha del inicio ("Martes 27") y el título de las hojas. También tapan el título de los pasos del alta.

## Dónde
- `styles.css`, cerca de la línea 341: `#toast { position: fixed; … top: calc(12px + var(--safe-t)); … }`.
- `app.js`, en `toast()`, cerca de la línea 70. Revisá si hay un motivo para que esté arriba: las hojas (`dialog.sheet`) se abren desde abajo y un aviso abajo quedaría detrás o encima de los botones. Probá los dos casos.

## Propuesta
- Avisos abajo, sobre la barra de pestañas (`bottom: calc(72px + var(--safe-b))`). Con un diálogo abierto, arriba del borde del diálogo o con `top` como hoy, según lo que se lea mejor en las capturas.
- Una entrada sutil (deslizar desde abajo) que respete `prefers-reduced-motion`.

## Criterios de aceptación
- En el inicio, el aviso no tapa la fecha ni el saludo.
- Con una hoja o el alta abiertos, el aviso no tapa los botones de acción.
- e2e en verde: `toastText()` lee `#toast` y no depende de la posición.
