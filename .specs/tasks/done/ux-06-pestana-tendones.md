# UX 6: la pestaña Tendones solo cuando importa

Reglas comunes en `ux-00-indice.md`. Prioridad media.

## Problema
La barra inferior siempre muestra cinco pestañas: Hoy, Entreno, Tendones, Historial y Ajustes. Para quien solo quiere entrenar, "Tendones" ocupa un lugar fijo y mantiene la imagen de "app de rehabilitación" que la bienvenida (v1.18.2) dejó atrás.

## Dónde
- `index.html`, en la `nav.tabbar` (líneas ~28–48): el botón `data-tab="tendons"`.
- `app.js`: el cambio de pestaña (línea ~92 y ~1066) y `renderTendons` (línea ~781).
- `renderSettings`: lugar para un acceso "Dolor y tendones".

## Propuesta
- Renombrar la pestaña a **"Dolor"**: es lo que el usuario reconoce, no la anatomía. Mantené el ícono del corazón o usá uno más adecuado, con el mismo estilo de los otros.
- Mostrarla solo si `S.painMode` está activo o hay zonas cargadas (`Object.keys(S.zones).length`). Si no, la barra tiene cuatro pestañas.
- En Ajustes, una fila "¿Te duele algo? Activá el modo dolor" lleva a la vista, para quien la necesite más adelante.
- Si la pestaña desaparece mientras el usuario está en ella, se vuelve a Hoy.

## Criterios de aceptación
- Usuario sin zonas ni modo dolor: cuatro pestañas, y se puede llegar a la vista desde Ajustes.
- Al marcar una zona o activar el modo dolor, aparece la pestaña "Dolor".
- e2e en verde: hay casos que usan `[data-tab="tendons"]`; mantené el `data-tab` o actualizá los casos.
