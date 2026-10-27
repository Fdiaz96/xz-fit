---
title: Agregar el plan Empuje/Tracción 4 días
depends_on: [plan-full-body-3-dias.feature.md]
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 4 de 7. Plan de recomposición ("gordiflaco") del canal: pocos ejercicios, casi todos compuestos, mucho esfuerzo.

**Plan `et4` — Empuje/Tracción 4 días** (fuente: [Dejar de ser gordiflaco en 2 minutos](https://www.youtube.com/watch?v=vtVrc2xDMdM) y [La forma simple de dejar de ser gordiflaco](https://www.youtube.com/watch?v=hFuyMJ2q-3M)): dos días de empuje y dos de tracción alternados, 3 series por ejercicio.
- **Empuje:** empuje horizontal (10–12) · empuje vertical (10–12) · rodilla dominante (10–12) · tríceps (10–12)
- **Tracción:** tracción vertical (10–12) · bisagra (8–10) · tracción horizontal (10–12) · bíceps (10–12)

Los rangos del video son más estrechos que los del tipo de ejercicio: el plan puede sobrescribir el rango por hueco (`{ slot, sets, reps }`); si el motor no lo soporta, agregarlo en esta tarea. Rotación: Empuje → Tracción → Empuje → Tracción (dos variantes de cada día si la biblioteca lo permite).

**Pruebas:** unit — `et4` resuelve sus huecos con el equipo por defecto; el rango del hueco gana al del ejercicio; e2e — elegir `et4` y completar un día de empuje.

## Description

// Will be filled in future stages by business analyst
