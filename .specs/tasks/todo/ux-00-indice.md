# Barrido de UX (2026-10-27): índice y reglas comunes

Barrido de todas las pantallas a 390 px (usuario nuevo, dolor en codo lateral). Cada punto es una tarea propia: se hace una por vez y entre una y otra se hace `/clear`.

Para arrancar una: `/clear` y después "hacé la tarea `.specs/tasks/todo/ux-NN-….md`".

## Orden

| # | Archivo | Qué resuelve | Prioridad |
|---|---|---|---|
| 1 | `ux-01-calibracion-una-vez.md` | La explicación de calibración se repite en cada ejercicio | Alta |
| 2 | `ux-02-placeholder-reps.md` | El "9" de reps parece un dato ya cargado | Alta |
| 3 | `ux-03-hoy-no-puedo-discreto.md` | "Hoy no puedo" compite con la acción principal | Alta |
| 4 | `ux-04-primer-dia-sin-descanso.md` | El primer día dice "Hoy es día de descanso" | Alta |
| 5 | `ux-05-explicar-60-y-calibrar.md` | "al 60 %" y "a calibrar" sin explicar | Alta |
| 6 | `ux-06-pestana-tendones.md` | La pestaña Tendones siempre visible para quien solo entrena | Media |
| 7 | `ux-07-historial-orden-y-vacios.md` | Historial arranca por dolor; vacíos sin acción | Media |
| 8 | `ux-08-tendones-casillas.md` | Zonas en Tendones con otro componente que en el alta | Media |
| 9 | `ux-09-boton-de-fase.md` | "Fase 2 →" invita a avanzar antes de tiempo | Media |
| 10 | `ux-10-pesos-con-unidad.md` | Pesos sin "kg" en Entreno; inicio y Entreno no coinciden | Baja |
| 11 | `ux-11-editar-rutina-botones.md` | Cuatro botones de ícono apretados; reset rojo pegado | Baja |
| 12 | `ux-12-avisos-abajo.md` | Los avisos (toast) tapan el encabezado | Baja |
| 13 | `ux-13-textos-sin-jerga.md` | Textos con jerga y cadenas con " · " | Baja |

Las tareas 1 y 5 tocan la misma nota de calibración (`app.js` en `renderWorkout`, cerca de la línea 455). Conviene hacer la 1 antes que la 5.

## Reglas para cada tarea

1. **Skill de UX**: cargá `frontend-design` antes de tocar la UI y seguila. Mantené la identidad actual: fondo negro, lima `--acc`, naranja `--pain` para todo lo de dolor y Oswald para títulos.
2. **Graphify**: corré `graphify query "<tema>"` antes de buscar en el código. Los números de línea de cada tarea son aproximados, del 2026-10-27; verificalos.
3. **Revisión visual**: sacá capturas con Playwright a 390 px, antes y después del cambio. Hay un ejemplo de script en `tests/e2e.mjs` (función `shot`). Las capturas del barrido original estaban en el scratchpad de la sesión y pueden no existir.
4. **Pruebas**: `node tests/e2e.mjs` tiene que terminar en "Todo OK". Si cambia un comportamiento, actualizá o agregá el caso.
5. **Publicar**:
   - Subí la versión en `app.js` (`APP_VERSION`) y `sw.js` (`CACHE`).
   - Agregá la entrada en `CHANGELOG.md`, en castellano rioplatense y orientada al usuario.
   - Corré `graphify update .`, hacé el commit y el push a `main` sin preguntar.
   - Al terminar, mové el archivo de la tarea a `.specs/tasks/done/`.
6. **Copy**: voseo y frases simples desde el punto de vista del usuario. Nada de MAYÚSCULAS de etiqueta ni cadenas "A · B · C". Los botones dicen exactamente lo que hacen.
