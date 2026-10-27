# Especificaciones de XZ Fit (SDD)

Esta carpeta sigue el flujo **Spec-Driven Development** del plugin `sdd` (context-engineering-kit):

```
/sdd:add-task "…"                      → crea .specs/tasks/draft/<nombre>.<tipo>.md
/sdd:plan-task .specs/tasks/draft/…    → criterios, arquitectura y pasos; pasa a todo/
/sdd:implement-task .specs/tasks/todo/… → implementa, revisa por fase y pasa a done/
```

Las features que ya existían antes de adoptar SDD están **retro-documentadas** en `tasks/done/`: mismo formato que una tarea planificada (descripción, criterios de aceptación, arquitectura), pero escritas a partir del código, los tests y el [CHANGELOG](../CHANGELOG.md). No tienen sub-tareas porque ya están implementadas.

## Estructura

| Carpeta | Qué tiene |
|---|---|
| `tasks/draft/` | Ideas nuevas sin planificar (`/sdd:add-task`) |
| `tasks/todo/` | Tareas planificadas, listas para implementar |
| `tasks/in-progress/` | En implementación |
| `tasks/done/` | Terminadas, incluidas las features retro-documentadas |
| `sub-tasks/<tarea>/` | Un archivo por paso de implementación (lo escribe `/sdd:plan-task`; no se mueve) |
| `analysis/` | Análisis del código: arquitectura, modelo de datos, reglas de negocio |
| `reports/` | Informes de revisión |
| `scratchpad/` | Archivos temporales de los agentes (ignorado por git) |

## Análisis del código

- [Arquitectura](analysis/arquitectura.md): archivos, capas, flujo de render y eventos, PWA, pruebas.
- [Modelo de datos](analysis/modelo-de-datos.md): el estado `S`, sesiones, zonas, equipo y migración.
- [Reglas de negocio](analysis/reglas-de-negocio.md): constantes y fórmulas de `logic.js` en un solo lugar.
- [Fuente: Mono Culturista](analysis/fuente-mono-culturista.md): principios y rutinas del canal, base de los planes de entrenamiento.

## Features (todas en `tasks/done/`)

| Feature | Archivo | Versiones |
|---|---|---|
| Primer uso y perfil | [primer-uso-perfil.feature.md](tasks/done/primer-uso-perfil.feature.md) | 1.0.0, 1.10.1 |
| Equipo a medida (discos, máquinas) | [equipo-a-medida.feature.md](tasks/done/equipo-a-medida.feature.md) | 1.0.0, 1.2.0, 1.6.0 |
| Peso sugerido y calibración | [peso-sugerido-calibracion.feature.md](tasks/done/peso-sugerido-calibracion.feature.md) | 1.0.0 |
| Entreno A/B, progresión y volumen | [entreno-ab-progresion-volumen.feature.md](tasks/done/entreno-ab-progresion-volumen.feature.md) | 1.0.0, 1.4.0 |
| Editor de rutina y ejercicios propios | [editor-rutina-ejercicios-propios.feature.md](tasks/done/editor-rutina-ejercicios-propios.feature.md) | 1.2.0, 1.7.0 |
| Modo dolor y rehabilitación por fases | [modo-dolor-rehabilitacion.feature.md](tasks/done/modo-dolor-rehabilitacion.feature.md) | 1.0.0, 1.8.0, 1.9.0 |
| Sesiones guiadas (temporizador, sonido, voz) | [sesiones-guiadas.feature.md](tasks/done/sesiones-guiadas.feature.md) | 1.3.0 |
| Entrada en calor | [entrada-en-calor.feature.md](tasks/done/entrada-en-calor.feature.md) | 1.5.0 |
| Progreso, récords, racha e historial | [progreso-historial.feature.md](tasks/done/progreso-historial.feature.md) | 1.4.0, 1.7.1 |
| Estancamiento y semana de descarga | [estancamiento-descarga.feature.md](tasks/done/estancamiento-descarga.feature.md) | 1.9.0 |
| Informe para el fisio | [informe-fisio.feature.md](tasks/done/informe-fisio.feature.md) | 1.5.0 |
| Ilustraciones animadas 3D | [ilustraciones-animadas.feature.md](tasks/done/ilustraciones-animadas.feature.md) | 1.1.0 → 1.14.0 |
| Datos locales y copia de seguridad | [datos-locales-copia.feature.md](tasks/done/datos-locales-copia.feature.md) | 1.0.0, 1.7.1 |
| Recordatorios en el calendario (.ics) | [recordatorios-calendario.feature.md](tasks/done/recordatorios-calendario.feature.md) | 1.0.0, 1.10.1 |
| PWA: sin conexión, instalación, tema y novedades | [pwa-tema-novedades.feature.md](tasks/done/pwa-tema-novedades.feature.md) | 1.0.0, 1.3.0, 1.6.0, 1.10.0, 1.14.x |

## Convenciones para tareas nuevas

- Nombre: `<verbo-objeto>.<tipo>.md` con tipo `feature`, `bug`, `refactor`, `test`, `docs`, `chore` o `ci`.
- Textos de la app en español rioplatense (vos), como en el resto del código.
- Toda regla nueva va como función pura en `logic.js` con su prueba en `tests/unit.mjs`; todo flujo visible, en `tests/e2e.mjs`.
- Cada versión suma su entrada en `CHANGELOG.md`, sube `APP_VERSION` en `app.js` y el nombre del caché en `sw.js`.
- Los datos guardados no se rompen: los campos nuevos toman valor por defecto en `DEFAULT()`/`withDefaults()`, y la prueba de migración de `tests/e2e.mjs` lo verifica.
