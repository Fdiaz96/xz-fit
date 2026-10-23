---
title: Implementar recordatorios por archivo de calendario (.ics)
status: implementado (retro-documentado)
versions: 1.0.0, 1.10.1
depends_on: [primer-uso-perfil.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG y de Ajustes → Recordatorios.

Recibir avisos para los isométricos y los entrenos sin servidor: la forma más confiable es agregarlos al calendario del teléfono.

# Description

Ajustes → *Recordatorios*: hora de isométricos mañana y noche, días de entreno (los mismos del primer uso y de "hoy toca entrenar") y hora del entreno. "📅 Agregar al calendario" genera `xz-fit.ics` (Web Share o descarga) con:

- Con modo dolor: dos eventos diarios (`FREQ=DAILY`) "XZ Fit: isométricos (mañana/noche)".
- Con días elegidos: un evento semanal `FREQ=WEEKLY;BYDAY=MO,TH…` "XZ Fit: entreno".
- Cada evento dura 15 min y tiene alarma al inicio. UIDs estables (`…@tendon-fuerte`) para que reimportar actualice en lugar de duplicar. Líneas con CRLF.

Sin modo dolor, Ajustes aclara que los isométricos no se incluyen.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — `.ics` con isométricos diarios a las 8 cuando el modo dolor está activo.
- [x] `CK-2` — Entreno lunes y jueves con CRLF.
- [x] `CK-3` — Sin modo dolor ni días, no hay eventos.
- [x] `CK-4` — El archivo descargado en e2e trae isométricos diarios y entreno lunes y jueves.

**Regular Checks:**
- `icsText` es pura y no depende del DOM.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Compatibilidad | 0,6 | Se importa bien en Google Calendar y Calendario de iOS |
| Coherencia | 0,4 | Usa los mismos días y horas que el resto de la app |

**Rubric Score Definitions:**
- 5: importa sin errores y coincide con la app · 3: requiere ajustes manuales · 1: no se importa.

**Test Strategy:**
- Unit: bloque `icsText`.
- e2e `// 9. Calendario y copia`.

**Definition of Done:**
- Unit y e2e en verde.

## Architecture Overview

- `logic.js`: `icsText(rem, painMode, today)`, `DAYS_ICS`.
- `app.js`: sección Recordatorios en `renderSettings`, acciones `rem-day`, `ics`; `shareFile`.
- Estado: `S.rem`.

## Implementation Process

Implementado antes de adoptar SDD. Sin sub-tareas.
