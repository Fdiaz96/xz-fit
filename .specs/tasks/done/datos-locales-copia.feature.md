---
title: Implementar el guardado local con copia de seguridad y migración de datos
status: implementado (retro-documentado)
versions: 1.0.0, 1.7.1
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del README (Privacidad) y del CHANGELOG (1.0.0, 1.7.1, 1.14.x).

Todos los datos viven solo en el teléfono, sin servidor ni cuentas; se puede guardar y restaurar una copia, y las versiones nuevas abren los datos viejos.

# Description

- **IndexedDB** `tendon-fuerte` → store `kv` → clave `data` con todo el estado `S`. Una sola conexión (se cierra si otra pestaña actualiza la base). Escrituras en serie; si falla, aviso "No se pudo guardar".
- **Almacenamiento persistente**: se pide al terminar el primer uso; Ajustes muestra si está concedido.
- **Copia de seguridad** (Ajustes): "Guardar copia" exporta `xz-fit-<fecha>.json` (`{ app: 'tendon-fuerte', version, data }`) por el menú Compartir o descarga. "Restaurar copia" valida que tenga `profile` y `sessions`, pide confirmación con la cantidad de sesiones y reemplaza todo.
- **Migración**: `withDefaults()` completa los campos nuevos con los valores de `DEFAULT()`.
- **Borrar todos los datos** con confirmación.
- **Renombre a XZ Fit**: los identificadores internos (`tendon-fuerte`) no cambiaron para conservar los datos; el navegador los guarda por origen (`fdiaz96.github.io`), no por ruta.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Los datos sobreviven a recargar.
- [x] `CK-2` — La copia trae las sesiones y restaurarla las recupera.
- [x] `CK-3` — Un archivo que no es copia de XZ Fit muestra un error y no toca los datos.
- [x] `CK-4` — Datos guardados por la v1.0 (sin rutina, preferencias ni equipo extra) se abren y la rutina se arma.
- [x] `CK-5` — Quien venía de antes ve la tarjeta de Novedades.

**Regular Checks:**
- Ninguna llamada de red con datos del usuario.
- Todo campo nuevo del estado tiene valor por defecto.
- Las copias de versiones anteriores se pueden restaurar.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Privacidad | 0,4 | Nada sale del teléfono sin acción explícita |
| Durabilidad | 0,4 | No se pierden datos entre versiones ni al recargar |
| Recuperación | 0,2 | Copia y restauración simples |

**Rubric Score Definitions:**
- 5: sin pérdidas ni fugas · 3: algún caso borde de migración · 1: pérdida de datos.

**Test Strategy:**
- e2e `// 9. Calendario y copia`, `// 10. Datos persistentes y sin conexión`, `// 11. Migración`.

**Definition of Done:**
- e2e en verde, incluida la migración.

## Architecture Overview

- `app.js`: `DEFAULT`, `db` (`open`, `get`, `set`), `withDefaults`, `persist`, `exportData`, `importData`, `shareFile`, `renderSettings` (estado de persistencia); acciones `export`, `import`, `reset`.
- Ver [modelo de datos](../../analysis/modelo-de-datos.md).

## Implementation Process

Implementado antes de adoptar SDD. Sin sub-tareas.
