---
title: Agregar el plan Full body 3 días (A/B/C) y el selector de planes
depends_on: [motor-de-planes.feature.md]
---

## Initial User Prompt

Quiero definir una ruta de cambios. Primero quiero tener distintos planes de entrenamiento. Un plan de cuerpo completo 3 dias a la semana, un plan de 6 dias a la semana enfocado en musculos. Buscar más planes destinados a resistencia o musculación. Luego mejorar la experiencia de usuario haciendo una encuesta para definir que rutina seguir. Cada esto que te pido es una tarea y feature a parte

https://www.youtube.com/@MonoCulturista basate en esto para armar el plan

La fuente esta en todos los videos

### Requirements

Tarea 2 de 7. Primer plan nuevo del catálogo; además trae la hoja para elegir plan, que reusan las tareas siguientes.

**Plan `fb3` — Full body 3 días, tres días distintos A/B/C** (fuente: [Rutina FULL BODY en casa](https://www.youtube.com/watch?v=NAdjjNPJKw0), lu/mi/vi; ver [fuente-mono-culturista.md](../../analysis/fuente-mono-culturista.md)). Cada día cuerpo completo, compuestos primero, 3 series por ejercicio, cada músculo 3 veces por semana con ejercicios distintos. Propuesta de huecos (a refinar en el plan):
- **A:** rodilla dominante · empuje horizontal · tracción horizontal · bisagra · lateral · abdominal
- **B:** unilateral · empuje vertical · tracción vertical · glúteo · bíceps · tríceps
- **C:** unilateral (otra variante) · empuje (flexiones/inclinado) · tracción horizontal (otra variante) · bisagra unilateral · deltoides posterior · abdominal

Con el equipo por defecto (mancuernas 2–24) y sin aros/banco/barra, cada día tiene que resolver al menos 5 de 6 huecos.

**Hoja "Elegí tu plan"** (`#plansheet`), desde Entreno → bloque "Tu plan" (nombre, días por semana, "Próximo: <día>", botón **Cambiar plan**):
- Tarjeta por plan: días por semana, duración aproximada (30–40 min), a quién apunta y "Fuente: Mono Culturista — <video>" con enlace.
- Los planes que no se pueden armar se muestran igual, con "Te falta: …".
- Cambiar de plan pide confirmación ("Tus pesos y tu historial se mantienen"), reinicia rotación y rampa (`S.plan.since`) y conserva la rutina del plan anterior en `S.routine` por si se vuelve.
- La sugerencia actual "¿Pasamos a 3 días?" pasa a "¿Probás Full body 3 días?" (misma condición de `suggestThreeDays`) y abre la hoja.
- `rem.train` al elegir 3 días propone lu/mi/vi si el usuario no tenía 3 días marcados.

**Pruebas:** unit — `fb3` resuelve sus huecos con el equipo por defecto y con todo el equipo; e2e — cambiar a `fb3`, entrenar A, el próximo es B; volver a `fb2` recupera la rutina anterior; la tarjeta "¿Probás Full body 3 días?" abre la hoja.

**Fuera de alcance:** la encuesta (tarea 7) y los demás planes.

## Description

// Will be filled in future stages by business analyst
