---
title: Implementar el modo dolor con rehabilitación de tendones en 3 fases
status: implementado (retro-documentado)
versions: 1.0.0, 1.8.0, 1.9.0
depends_on: [primer-uso-perfil.feature.md, equipo-a-medida.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del README, el CHANGELOG (1.0.0, 1.8.0, 1.9.0) y el video de Jeremy Ethier con Keith Baar y Coach Q.

Un modo dolor que **activa el usuario**: rehabilitación diaria de las zonas marcadas en 3 fases (isométricos → isotónicos lentos → integración), registro de dolor 0–10, ajuste automático de la carga y un entreno que cuida esas zonas.

# Description

**Zonas y fases** (pestaña Tendones): 6 zonas (`ZONES`: codo lateral, codo medial, muñeca, hombro, rodilla, Aquiles) con lado. Fases (`PHASES`):
1. **Isométricos**: 3 × 45 s, mañana y noche.
2. **Isotónicos lentos**: 3 × 15 a 3 s / 3 s, día por medio.
3. **Integración**: ejercicios normales con todo el peso + 3 isométricos de 30 s de mantenimiento al final del entreno.

**Opciones por fase** (`REHAB_OPTIONS`): la primera es la del protocolo del video; se puede elegir otra (p. ej. Tyler twist con toalla, rotación externa isométrica en la pared). Solo aparecen las posibles con el equipo; al cambiar, la carga arranca desde lo mínimo.

**Ejercicios del fisio** (`S.custom`): nombre, zona, series, reps o segundos y nota; aparecen al final de cada sesión de rehab.

**Rehabilitación del día** (Inicio): tarjeta con los ejercicios de la franja (mañana < 15 h, noche), estado mañana ✓ / noche ✓, y la sesión guiada (ver [sesiones guiadas](sesiones-guiadas.feature.md)).

**Dolor 0–10**: al terminar rehab o un entreno con zonas cuidadas, `#painsheet` pide el dolor de cada zona. También "Anotar cómo está el dolor ahora" en Inicio (sesión `type: 'dolor'`).

**Ajuste automático de carga** (`isoAdjust`):
- Dolor > 4 en la rehab → baja un salto en el momento (marca `adjustedOn`).
- "¿Cómo amaneció?" al día siguiente (mejor / igual / peor): dolor ≤ 2 y no peor → sube; > 4 o peor → baja; si ya bajó ayer y no está peor, no vuelve a bajar.
- Sin peso o en el mínimo se juega con el tiempo (20–60 s); a los 60 s sin peso agrega la mancuerna más liviana.

**Avance de fase**: "lista para avanzar" con ≥ 10 días en la fase, registros suficientes en 7 días (5 en fase 1, 3 en fase 2), todos ≤ 3 y sin "peor". Se puede avanzar igual con confirmación, o volver de fase.

**Entreno cuidado**: ejercicios cuyo `tag` incluye una zona en fase 1–2 → tope del 60 % del peso de trabajo; si la zona está en brote (dolor > 4 en 3 días o amaneció peor) y existe `alt` → variante amable. Sin progresión mientras haya tope.

**Sugerencia**: con zonas marcadas y el modo apagado, Inicio ofrece activarlo ("Ahora no" la oculta). Aviso legal permanente: no reemplaza a un profesional.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Con el modo dolor apagado no hay restricciones ni rehabilitación.
- [x] `CK-2` — Codo lateral en fase 1 → extensión de muñeca isométrica; remo, peso muerto y curl van al 60 %; la sentadilla no se restringe.
- [x] `CK-3` — Dolor > 4 ayer → variante amable.
- [x] `CK-4` — Dolor 6 en la rehab → baja la carga en el momento (en el mínimo, baja el tiempo) y avisa.
- [x] `CK-5` — Pregunta cómo amaneció solo si ayer hubo dolor registrado y una sola vez por día.
- [x] `CK-6` — Muñeca con dolor 2 y amaneció mejor → sube a 4 kg; codo ya ajustado ayer → no vuelve a bajar.
- [x] `CK-7` — Puntas de pie: a los 60 s sin peso agrega mancuernas; con dolor vuelve a sin peso.
- [x] `CK-8` — Lista para avanzar con 19 días y 6 registros ≤ 3; un 4 en la semana o < 10 días la frena.
- [x] `CK-9` — Elegir Tyler twist para la fase 2 del codo se refleja en la tarjeta y en las sesiones.
- [x] `CK-10` — Los ejercicios del fisio aparecen en la sesión y en el informe.
- [x] `CK-11` — El dolor anotado en cualquier momento cuenta para gráficos, informe y avance de fase.

**Regular Checks:**
- El modo dolor nunca se activa sin acción del usuario.
- Umbrales centralizados en `PAIN_MAX`, `PAIN_CAP`, `ISO_*`, `LENTO_*`.
- El aviso médico está visible en Tendones, en el primer uso y en Fuentes.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Fidelidad al protocolo | 0,35 | Fases, dosis y regla del 3–4/10 como en la fuente |
| Seguridad | 0,35 | Ante dolor la carga baja; nunca sube con dolor > 2 ni con "peor" |
| Autonomía del usuario | 0,3 | Puede elegir ejercicios, cambiar de fase y desactivar el modo |

**Rubric Score Definitions:**
- 5: reglas exactas y seguras en todos los escenarios probados · 3: algún escenario ambiguo · 1: la carga puede subir con dolor.

**Test Strategy:**
- Unit: bloque "Modo dolor" (`restriction`, `zoneFlare`, `pendingChecks`, `isoAdjust`, `phaseReady`).
- e2e `// 3. Modo dolor`, `// 5. Rehabilitación`, `// 6. ¿cómo amaneció?`, `// 6b.`, `// 7. Ejercicio propio del fisio`.

**Definition of Done:**
- Unit y e2e en verde; CHANGELOG actualizado.

## Architecture Overview

- `logic.js`: `painLog`, `zoneFlare`, `restriction`, `painCap`, `isoAdjust`, `phaseReady`, `pendingChecks`, `weekStats` (objetivo de rehab).
- `app.js`: `renderTendons`, `rehabEx`, `rehabOptions`, `rehabItems`, `maintenanceItems`, `newZone`, `askPain`, `renderPain`, `savePain`, `answerCheck`, `openCustom`; acciones `pain-mode`, `zone-toggle`, `zone-side`, `phase`, `rehab-choice`, `check`, `quick-pain`, `custom-*`.
- `data.js`: `ZONES`, `PHASES`, `REHAB`, `REHAB_OPTIONS`, `tag` y `alt` en ejercicios.
- Estado: `S.painMode`, `S.zones`, `S.checks`, `S.custom`, `session.pain`.

## Implementation Process

Implementado antes de adoptar SDD (1.0.0 base; 1.8.0 opciones por fase; 1.9.0 dolor en cualquier momento). Sin sub-tareas.
