---
title: Agregar el plan de isométricos sin equipo
depends_on: [plan-full-body-3-dias.feature.md]
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 6 de 7. Cubre el pedido de "planes de resistencia": el canal no tiene planes de resistencia, y lo más cercano es su circuito de isométricos de cuerpo completo sin equipo.

**Plan `iso` — Isométricos, 3–4 días** (fuente: [7 ejercicios isométricos](https://www.youtube.com/watch?v=o59XMtkJylk)): un solo día que se repite, 2 series por ejercicio hasta el fallo técnico (se termina cuando se rompe la postura), descanso suficiente para repetir bien.
- Suspensión en barra · silla invisible · puente de glúteo isométrico · hollow hold · elevación de talones isométrica · flexión a medio recorrido · bird dog isométrico

**Registro:** en segundos (`kind: 'tiempo'`); la progresión es por tiempo (récord por ejercicio), no por peso.

**Ejercicios nuevos con ilustración:** suspensión, puente isométrico, hollow hold, flexión a medio recorrido, bird dog. Silla invisible (`sentadilla_pared`) y talones (`iso_talones`) ya existen. La suspensión necesita barra o aros; sin ellos, el hueco queda vacío.

**Modo dolor:** el "fallo técnico" se reemplaza por la regla del protocolo (dolor ≤ 4/10) en las zonas en fase 1–2, y el ejercicio lo dice. Este plan no reemplaza la rehabilitación.

**Pruebas:** unit — figuras nuevas sin coordenadas inválidas; el plan resuelve 6 de 7 huecos sin equipo; e2e — completar una sesión del plan y ver el récord de segundos.

## Description

// Will be filled in future stages by business analyst
