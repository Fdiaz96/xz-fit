# UX 13: textos sin jerga ni cadenas con puntos medios

Reglas comunes en `ux-00-indice.md`. Prioridad baja. Conviene hacerla al final, porque las tareas anteriores cambian textos.

## Problema
Varios textos usan jerga interna o cadenas "A · B · C" que cuestan leer:
- Sesión de rehabilitación: "Codo lateral · Fase 1 · Isométricos · ejercicio 1 de 1" (`app.js`, cerca de la línea 674).
- Inicio con modo dolor: "0 de 14 rehabs" (`app.js`, cerca de la línea 222).
- Detalle de ejercicio: "Exige: Rodilla" (`app.js`, cerca de la línea 424).
- Título de la sesión de rehabilitación: "REHAB · MAÑANA".
- Tendones: "Fase 1 · Isométricos · desde mar, 27 oct".

## Propuesta
- Rehabilitación: "Ejercicio 1 de 1 para tu codo lateral" y, aparte y más chico, "Fase 1: isométricos".
- Inicio: "0 de 14 sesiones de rehabilitación esta semana", o un texto más corto que se entienda.
- Detalle: "Carga la rodilla" o "Usa: rodilla".
- Título: "Rehabilitación de la mañana".
- Tendones: "Fase 1: isométricos, desde el martes 27 de octubre".
- Hacé un barrido completo con `grep -n " · " app.js` y cambiá los que el usuario lee. Los de código o comentarios no hace falta.

## Criterios de aceptación
- No quedan cadenas con " · " en texto visible, salvo los separadores visuales que tengan un motivo claro.
- No aparecen "rehabs" ni "Exige:".
- e2e en verde: actualizá los casos que buscan estos textos.
