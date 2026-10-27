---
title: Agregar la encuesta que recomienda el plan de entrenamiento
depends_on: [plan-torso-pierna-4-dias.feature.md, plan-empuje-traccion-4-dias.feature.md, plan-grupos-5-dias.feature.md, plan-isometricos.feature.md]
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 7 de 7. Encuesta corta que recomienda un plan del catálogo y explica por qué; el usuario confirma o elige otro.

**Preguntas** (una por pantalla):
1. ¿Qué buscás? *Ganar músculo desde cero · Dejar de ser gordiflaco · Perder grasa y definir* (los tres objetivos de los planes del canal).
2. ¿Cuántos días podés entrenar? *2 · 3 · 4 · 5*.
3. ¿Dónde? *Con mi equipo · Sin nada*.

Se guarda en `S.profile.goal` y `S.profile.days` (ahora 2–5). "Sin nada" guarda `S.plan.bw = true` (huecos resueltos solo con peso corporal).

**Recomendación** — `recommendPlan(respuestas, S)` en `logic.js`, pura:

| Días | Recomienda | Alternativa |
|---|---|---|
| 2 | Full body 2 | — |
| 3 | Full body 3 | Isométricos si "sin nada" |
| 4 | Torso/Pierna 4 (músculo, grasa) · Empuje/Tracción 4 (gordiflaco) | el otro de 4 días |
| 5 | Por grupos 5 con experiencia ≥ 6 meses; si no, Torso/Pierna 4 ("empezá con 4") | Torso/Pierna 4 |

- Con modo dolor y alguna zona en fase 1: como mucho 3 días, con la razón.
- La pantalla de resultado muestra el plan, 2 o 3 razones con los principios del canal (cada músculo 2 veces por semana, sesiones de 30–40 min, compuestos primero…) y *Usar este* / *Ver otros planes* (abre `#plansheet`).
- El objetivo solo cambia la recomendación y los textos; pasos y cardio quedan fuera.

**Dónde aparece:**
- Primer uso: nuevo paso 5, después de "¿Te duele algo?". El paso de perfil pierde el selector de días (lo pregunta la encuesta) y mantiene los días de la semana; al elegir 4 propone lu/ma/ju/vi y con 5, lu a vi.
- `#plansheet`: "Respondé 3 preguntas y te recomendamos uno".
- Usuarios existentes: no se les fuerza; siguen en Full body 2 días y la tarjeta de Novedades los invita a probar.

**Pruebas:** unit — tabla completa de `recommendPlan`, incluido el tope por modo dolor; e2e — primer uso con encuesta y recomendación aceptada; repetir la encuesta desde Entreno y elegir otro plan; usuario migrado sin encuesta forzada.

## Description

// Will be filled in future stages by business analyst
