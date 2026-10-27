---
title: Agregar el plan Torso/Pierna 4 días
depends_on: [plan-full-body-3-dias.feature.md]
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 3 de 7. El usuario pidió un plan de 6 días "enfocado en músculos"; como el canal nunca propone más de 5 días y critica entrenar 6, se reemplazó por los planes del canal (decisión del brainstorm del 2026-10-26). Este es el principal para hipertrofia.

**Plan `tp4` — Torso/Pierna 4 días** (fuente: [El método griego (forma de V)](https://www.youtube.com/watch?v=aEawunv6L9I) y [Dejar de ser gordiflaco en 90 días](https://www.youtube.com/watch?v=xAAB_3xZ-Ho)): 2 días de torso y 2 de pierna, cada músculo 2 veces por semana, 3 series por ejercicio, compuestos primero.
- **Torso A:** empuje horizontal · tracción vertical · tracción horizontal · empuje vertical · lateral · bíceps · tríceps
- **Pierna A:** rodilla dominante · bisagra · gemelos · abdominal
- **Torso B:** empuje inclinado · tracción horizontal · tracción vertical · lateral · deltoides posterior · bíceps/tríceps
- **Pierna B:** unilateral · bisagra (otra variante) · glúteo · gemelos · abdominal

Rangos según el ejercicio (motor): press 6–12, laterales 12–20, curl y tríceps 10–15. Orden de rotación: Torso A → Pierna A → Torso B → Pierna B. Días de recordatorio sugeridos: lu/ma/ju/vi.

**Ejercicios que pueden faltar en la biblioteca** (decidir en el plan si se agregan, con figura y pruebas, o si el hueco usa una alternativa existente): press inclinado con mancuernas, elevación posterior con mancuernas (pájaros), crunch con peso o elevación de piernas.

**Pruebas:** unit — `tp4` resuelve todos los huecos con mancuernas + banco y al menos 80 % sin banco; e2e — elegir `tp4`, hacer Torso A, el próximo es Pierna A; la rampa muestra 2 series la primera semana.

## Description

// Will be filled in future stages by business analyst
