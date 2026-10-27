---
title: Agregar el plan por grupos musculares de 5 días
depends_on: [plan-full-body-3-dias.feature.md]
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 5 de 7. Reemplaza al "plan de 6 días enfocado en músculos" del pedido original: es la rutina del canal con más días y separada por grupos.

**Plan `gr5` — Por grupos 5 días** (fuente: [Físico atlético en 90 días](https://www.youtube.com/watch?v=48OsVIHE9jk)), 3 series por ejercicio, 1–2 RIR:
- **Pecho y tríceps:** empuje horizontal · empuje inclinado/apertura · tríceps (fondos/extensión)
- **Hombros y abdomen:** empuje vertical · lateral · abdominal · abdominal inferior
- **Espalda:** tracción vertical · tracción horizontal · bisagra
- **Piernas y abdomen:** rodilla dominante · unilateral · abdominal · abdominal inferior
- **Libre:** día editable para "lo que quieras reforzar"; arranca con bíceps · lateral · deltoides posterior

El canal entrena cada grupo 1 vez por semana en este plan, contra su propia regla de "≥ 2 veces". La tarjeta del plan lo dice ("más días, sesiones cortas por grupo") y la encuesta solo lo recomienda con experiencia ≥ 6 meses.

**Ejercicios que pueden faltar:** apertura con mancuernas, fondos en silla/paralelas, crunch con peso, elevación de piernas. Si no se agregan, los huecos usan alternativas existentes.

**Pruebas:** unit — `gr5` resuelve sus huecos con mancuernas; el día "Libre" es editable y conserva los cambios; e2e — rotación de los 5 días.

## Description

// Will be filled in future stages by business analyst
