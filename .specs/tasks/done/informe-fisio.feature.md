---
title: Implementar el informe imprimible para el fisio
status: implementado (retro-documentado)
versions: 1.5.0
depends_on: [modo-dolor-rehabilitacion.feature.md, progreso-historial.feature.md]
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.5.0).

Un informe para compartir con el fisioterapeuta o imprimir como PDF, con las últimas 6 semanas de rehabilitación.

# Description

Historial → *Informe para el fisio* genera `informe-xz-fit-<fecha>.html` y lo comparte (Web Share) o lo descarga. Es una página independiente, en claro, con estilos de impresión:

- Encabezado: nombre, período (42 días), versión de la app, resumen del protocolo y si el modo dolor está activo.
- Cantidad de sesiones de rehabilitación y de entrenos.
- Por cada zona activa o con dolor registrado: lado, fase actual y desde cuándo, ejercicio y carga, segundos por serie (fase 1), dolor inicial; gráfico de dolor con el límite 4/10; tabla de 6 semanas con dolor promedio y máximo; conteo de "¿cómo amaneció?" (mejor / igual / peor).
- Ejercicios indicados por el fisio.
- Botón "Imprimir o guardar como PDF" (oculto al imprimir).

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — El informe incluye las zonas y el gráfico de dolor.
- [x] `CK-2` — Solo se ofrece si hay sesiones.
- [x] `CK-3` — Usa el ejercicio elegido por el usuario en cada zona.
- [x] `CK-4` — Todo texto del usuario va escapado.

**Regular Checks:**
- El HTML es autocontenido (sin recursos externos) y se imprime bien en A4.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Utilidad clínica | 0,6 | El fisio ve fase, carga, dolor y respuesta al día siguiente |
| Portabilidad | 0,4 | Se abre en cualquier navegador y se imprime sin ajustes |

**Rubric Score Definitions:**
- 5: completo y portable · 3: falta algún dato o se imprime mal · 1: no se puede abrir.

**Test Strategy:**
- e2e `// 8d. Informe para el fisio` (descarga y revisa contenido).

**Definition of Done:**
- e2e en verde.

## Architecture Overview

- `app.js`: `reportHTML()`, `lineChart()`, `painHistory()`, `shareFile()`; acción `report`.

## Implementation Process

Implementado antes de adoptar SDD (1.5.0). Sin sub-tareas.
