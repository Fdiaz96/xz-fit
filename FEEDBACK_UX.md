# Feedback de uso (agentes como usuarios)

Cada sección la escribió un agente sin contexto que usó la app como usuario.

## Pantalla: Alta / primer uso

**Lo que funciona bien:**
- La bienvenida es clara: 4 beneficios cortos, "Te toma un minuto" y "tus datos quedan solo en este teléfono" generan confianza. El CTA "Armar mi rutina" se ve enseguida.
- La barra de 5 pasos muestra cuánto falta, y "Atrás" conserva lo cargado.
- En "Tu plan", "Ver ejercicios" muestra cada día antes de elegirlo y avisa cuántos ejercicios quedan como "falta equipo".
- Al terminar, Hoy trae el saludo con el nombre, el Día A con pesos "estimado" y un único botón "Empezar día A".

**Problemas y mejoras**
- [Alta] Acepta datos imposibles — peso 5 kg, edad 200, mancuernas mín 30 > máx 10 pasan sin aviso. Validar rangos (peso 30–250, edad 12–100, mín < máx, salto > 0) con error en rojo debajo del campo.
- [Alta] Sin equipo, el plan queda roto — apagando Mancuernas sin marcar nada más, el plan avisa "11–20 ejercicios quedan como falta equipo". Agregar "Solo peso corporal" y armar el plan con eso, o frenar en el paso Equipo con aviso claro.
- [Alta] Declaro dolor y la rutina no cambia — con codo lateral dolor 5, aparece Press en banco con carga completa y un cartel "Activar modo dolor". Preguntarlo en el mismo paso ("¿Activar el cuidado ahora?", activado por defecto).
- [Media] Los errores no señalan el campo — "Poné tu peso…" aparece arriba tapando el título; el campo no se marca ni recibe foco. Borde rojo, mensaje debajo, foco al campo. Marcar "(opcional)" Nombre, Altura y Edad.
- [Media] El aviso pasa al paso siguiente — "Full body 3 días usa 3 días. Tocá uno marcado…" sigue visible en "¿Te duele algo?" tapando el título. Cerrar avisos al cambiar de paso y explicar la regla de días en la tarjeta.
- [Media] El dolor arranca en 5 — al marcar zona, la escala viene en 5 y el lado en "derecha". Dejarlos sin elegir y pedirlos.
- [Baja] Siglas que no se entienden — días "TA PA TB PB" y "Pe Ho Es Pi Br". Nombres completos o leyenda.
- [Baja] Modo claro y detalles — en modo claro se ve igual que oscuro; tocar el texto "Mancuernas" no prende el interruptor; al volver con Atrás la pantalla queda a mitad de scroll. Soportar tema claro (o explicarlo), fila entera tocable, scroll arriba al navegar.

## Pantalla: Hoy

**Lo que funciona bien:**
- Se entiende de un vistazo: saludo, fecha, nombre del día enorme, lista con series × reps y peso. "Empezar …" fijo abajo.
- Tocar un ejercicio abre una ficha muy buena (dibujo, técnica, músculos, "Cuidado si te duele", qué es "estimado"); cierra con "Cerrar" o Esc.
- Después de entrenar se actualiza sola: punto de la semana, "1 de 4 entrenos esta semana", "✓ Entreno de hoy hecho", resumen de lo próximo.
- "Salir" del entreno pide confirmación.

**Problemas y mejoras**
- [Alta] Después de entrenar te sigue empujando a entrenar — con "Entreno de hoy hecho" muestra "PIERNA A" en grande y "Empezar Pierna A" igual de destacado. Estado de descanso: "Hoy ya entrenaste", resumen chico de lo hecho, "Próximo: Pierna A, el jueves" secundario y botón secundario "Entrenar igual".
- [Alta] No avisa si hoy es día de descanso — plan Lu/Ma/Ju/Vi, hoy miércoles, y propone Torso A como si tocara. Si el día no está en el plan: "Hoy descansás · próximo: Torso A el jueves" con empezar igual como opción secundaria.
- [Media] No se encuentra el "modo dolor" en Hoy — el alta dice "lo activás desde el inicio" pero en Hoy no hay acceso. Enlace "¿Te duele algo hoy?" debajo de la lista, o corregir el texto del alta.
- [Media] Los puntitos de la semana dicen poco — no muestran día ni entreno y no se pueden tocar. Tira Lu–Do con sigla del entreno, hoy resaltado, hechos tildados; tocar un día muestra qué toca.
- [Media] Falta la duración — "7 ejercicios · ~45 min" junto al título.
- [Baja] El título gigante pisa al subtítulo — más espacio abajo o título algo más chico.
- [Baja] Textos que sobran — ocultar "Último: …" cuando es hoy; explicar "estimado" una sola vez en vez de la etiqueta en cada ejercicio.
- [Baja] Falta pista de que los ejercicios se tocan — chevron "›" sutil o miniatura del dibujo.
- (Nota para Entreno) Al tildar 14 series el resumen dijo "1 serie"; posible toque bajo el cartel de descanso. Revisar.

## Pantalla: Entreno en curso y resumen

**Lo que funciona bien:**
- El conteo del resumen coincide con lo tildado (probado en dos entrenos: "11 de 12" → "11 series"; 8 → "8 series"); los kg levantados dan bien. El bug de "1 serie" no se reprodujo.
- Tildar/destildar actualiza contador y barra de progreso.
- "Cambiar por hoy", "Saltear este ejercicio" y "Otro motivo" son claros.
- El ajuste automático de peso tras la primera serie y su aviso se sienten inteligentes.

**Problemas y mejoras**
- [Alta] El entreno en curso se pierde al recargar — Empezar, tildar S1, recargar: vuelve a Hoy sin forma de retomar. Guardar el estado tras cada tilde y ofrecer "Seguir entreno" al volver.
- [Alta] El cartel de descanso tapa lo que hay que tocar — la barra "Descanso" + el aviso de ajuste apilado tapan ~160 px donde están kg/reps/RIR/✓ de la serie siguiente. Scroll automático a la serie siguiente, margen inferior del alto de la barra, aviso que se vaya a los 2 s o arriba.
- [Media] El descanso arranca tras la última serie del entreno y en Plancha — la barra de 1:30 tapa TERMINAR ENTRENO. No iniciar el descanso en la última serie; duración según ejercicio.
- [Media] El resumen no muestra lo salteado ni lo no hecho, y no confirma al terminar con series pendientes. Agregar "Salteaste: …", "1 serie sin hacer" y aviso antes de terminar.
- [Media] Tildar sin cargar guarda las reps sugeridas sin avisar (placeholder "≈13" → 13). Mostrar el valor ya cargado (no como placeholder) o aviso "Anotamos 13 reps".
- [Media] Al empezar, la primera serie queda fuera de pantalla — entrada en calor, "Pesos estimados" y explicación del RIR (abierta sin pedirla) arriba. Plegarlas y dejar la serie 1 a la vista.
- [Baja] El resumen sugiere "Mismo peso la próxima" para un cambio solo por hoy y no dice qué pasa con el original; récords como "18.2 kg (1RM estimado)" con decimal raro y sigla sin explicar.
- [Baja] Plancha sin cronómetro de 30 s; mucho espacio vacío al final al scrollear y el encabezado deja de verse.

## Pantalla: Rutina y planes

**Lo que funciona bien:**
- Acciones de edición claras (↑/↓, Cambiar, Quitar, "+ Agregar ejercicio", pestañas por día); los cambios se ven enseguida en Hoy.
- "Quitar" sin confirmación pero con "Deshacer" en el aviso.
- "Cambiar ejercicio" muestra primero "Mismo movimiento…"; los que requieren equipo faltante salen grisados con "Falta: banco".
- Cambiar de plan es seguro ("Tus pesos y tu historial se mantienen"); al volver, los cambios siguen. Crear ejercicio propio es rápido.

**Problemas y mejoras**
- [Alta] No se pueden editar series ni reps — "2 × 6–12 reps" es texto fijo; el ejercicio propio tampoco tiene esos campos. Si la app lo decide sola, decirlo ("las series las ajusta la app"); si no, control de series y rango por ejercicio.
- [Alta] El selector no tiene buscador — ~35 ejercicios en 7 grupos. Campo "Buscar" fijo arriba que filtre por nombre.
- [Media] Se pueden agregar duplicados sin aviso — Editar rutina → Torso A → + Agregar → "Curl martillo" (ya está) queda dos veces. Marcar "Ya está en este día" o confirmar.
- [Media] "Vuelve con los cambios que le hiciste" en planes nunca tocados — Full body 2 días lo muestra sin haberlo usado; Full body 3 días tras solo usarlo. Mostrarlo solo si hay ejercicios cambiados, y decir cuáles.
- [Media] Mover un día cuesta varios toques — con el plan lleno hay que sacar uno y luego elegir el nuevo; y los días solo se cambian dentro de "Cambiar plan". Días tocables en la tarjeta "Tu plan"; si toco un día libre con el plan lleno, mover ahí el día más cercano.
- [Media] Los avisos tapan controles — "Ejercicio agregado" tapa "+ Agregar ejercicio"; "Ejercicio cambiado" tapa los botones del ejercicio; en Cambiar plan el aviso de días tapa "Cancelar". Mostrarlos sin pisar botones o que duren menos.
- [Baja] El encabezado del selector se mezcla con la lista al scrollear — "Cancelar / AGREGAR A TORSO A" sin fondo. Fondo sólido.
- [Baja] Textos poco claros — "Exige rodilla / hombro…" en todos los ejercicios sin dolor marcado (mostrar solo con modo dolor); "Volver al plan original" usa confirm del navegador y no aclara si afecta un día o todos; cargar una máquina manda a Ajustes → Equipo: sumar "+ Agregar máquina" en "Nuevo ejercicio".

## Pantalla: Tendones / modo dolor

**Lo que funciona bien:**
- La sesión de rehab está muy bien: ilustración, círculo grande con cuenta regresiva ("sostené"/"descanso"), "Saltar descanso" y la serie siguiente arranca sola.
- La pestaña Dolor explica bien la fase (Fase 1: isométricos 3×45 s mañana y noche), barra hacia la fase 2 y motivo cuando no se avanza.
- La rutina se adapta ("más liviano por tu codo", "variante por tu codo"); apagar el modo vuelve a pesos completos con toast claro.
- "Avanzar igual" pide confirmación y explica el riesgo.

**Problemas y mejoras**
- [Alta] El modo dolor se activa en un lugar escondido — la tarjeta "Tenés dolor en … / Activar modo dolor" queda abajo de todo en Hoy, tras la rutina y Empezar. Ponerla arriba de la rutina, o "¿Lo activamos ya?" al terminar el alta.
- [Alta] Si cerrás en "¡Listo!", la sesión de rehab no se guarda — hacer las 3 series y cerrar sin tocar "Terminar y anotar dolor": vuelve "0 de 14 sesiones" y la noche sigue en "Toca ahora". Guardar la sesión al completar la última serie; el registro de dolor como paso aparte, posterior.
- [Media] La pantalla "¡Listo!" está vacía — agregar resumen (3/3 series, 45 s, "Noche hecha, mañana te toca a la mañana") y algo de festejo.
- [Media] Al terminar la rehab, la tarjeta Mañana/Noche desaparece de Hoy sin confirmar — dejarla con "Noche ✓" y lo próximo.
- [Media] "Anotar cómo está el dolor ahora" abre "¿Cuánto dolió? Durante el ejercicio…" fuera de un ejercicio, y el botón queda abajo de todo en Hoy — texto según contexto ("¿Cuánto te duele ahora?") y acceso en la pestaña Dolor.
- [Media] La serie isométrica cuenta completa aunque cortes a los 3 s y suma a la fase — guardar el tiempo real sostenido y avisar si fue muy corto.
- [Media] Los cambios de la rutina no se explican — Remo a un brazo → "Curl isométrico", Peso muerto rumano → "Puente de glúteos" sin aviso. Aviso "Cambiamos 2 ejercicios por tu codo (ver por qué)".
- [Baja] Historial: "Registro de dolor — sin hacer" parece tarea pendiente; el gráfico de dolor por zona muestra 5/10 aunque después se anotó 2 — aclarar qué valor se grafica. "Avanzar igual" usa confirm nativo del navegador.
- (Nota) En un primer intento, la zona marcada en el alta pareció no guardarse (Ajustes sin el codo, sin pestaña Dolor); no se reprodujo en una segunda alta.

## Pantalla: Historial

**Lo que funciona bien:**
- La pantalla vacía orienta bien ("Todavía no entrenaste", botón Empezar, gráfico fantasma).
- La lista de sesiones se lee rápido; tocar una despliega el detalle, de a una.
- "Eliminar sesión" borra al instante con "Deshacer" que no tapa la barra.
- Gráfico con un solo día bien resuelto; el "?" explica cada punto en lenguaje simple.

**Problemas y mejoras**
- [Alta] El gráfico no muestra el progreso — eje Y desde 0 (0/7/14): 12→14 kg casi no se nota; sin "kg"; solo primera y última fecha. Eje Y ajustado al rango real con unidad y resumen arriba ("+2 kg en 2 semanas").
- [Alta] La etiqueta del punto queda tapada y cortada — Historial → "Remo inclinado con dos mancuernas" → tocar el primer punto: "12 kg el jue, 1 oct" pisa el selector y se sale por la izquierda. Mantenerla dentro de la tarjeta; debajo del punto si arriba no entra.
- [Alta] "Informe para el fisio" no sirve sin modo dolor — descarga un .html sin aviso; dice "0 sesiones de rehabilitación… Sin zonas con dolor"; el período arranca antes del primer entreno. Sin modo dolor, ocultarlo o cambiarlo por "Exportar mis entrenos"; aviso "Informe descargado"; período desde la primera sesión.
- [Media] El trofeo 🏆 no se explica — no dice qué récord ni en qué ejercicio. Marcar el ejercicio con récord en el detalle ("🏆 Remo: 14 kg, nuevo máximo") y sección "Récords" con el mejor peso por ejercicio.
- [Media] El detalle es ambiguo — "12×12, 12×12" no distingue kg de reps; sin RIR. "12 kg × 12 reps" o mini tabla kg / reps / RIR.
- [Media] El número grande de cada sesión aporta poco ("7 ejercicios") — destacar kg levantados/récords o comparar con la vez anterior del mismo día.
- [Baja] Selector de ejercicio largo sin orden claro — agrupar por día o zona, o al menos alfabético.
- [Baja] Falta vista por semana — agrupar ("Semana del 12 oct: 2 de 4 entrenos") y racha de semanas cumplidas.

## Pantalla: Ajustes

**Lo que funciona bien:**
- Los cambios se guardan solos y se reflejan enseguida en Hoy (peso corporal, mancuerna más pesada).
- Agregar máquina bien resuelto: valida nombre y rango, la muestra como "Polea 5–80 kg, de a 5", confirma antes de eliminar.
- Copia de seguridad de punta a punta: exporta JSON, rechaza archivos ajenos con mensaje claro, restaura con confirmación.
- El tema claro se ve prolijo; "se lee mejor a pleno sol" ayuda.

**Problemas y mejoras**
- [Alta] Perfil sin validación — peso -5, 0, 2000 o vacío y edad 5 se guardan; con -5 kg Hoy sugiere 2 kg en todo. Rangos (peso 30–250, edad 12–100), mensaje en rojo debajo del campo, mantener el último valor válido.
- [Alta] Rango de mancuernas imposible sin aviso — Más liviana 30 / Más pesada 10 deja todo "sin peso" en Hoy. Misma validación que las máquinas (mín ≤ máx), en el lugar.
- [Media] No se sabe si se guardó — "Guardado ✓" chiquito junto al campo.
- [Media] Marcar Banco no cambia la rutina — el aviso manda a Entreno → Editar rutina; agregar botón "Cambiar ahora" en el aviso.
- [Media] Guardar copia es silencioso — aviso "Copia guardada" y "Última copia: 29/10" debajo del botón; recordatorio cada tanto.
- [Media] Novedades escritas para desarrolladores — "Epley", "IndexedDB", "PWA", "wger (usuario Franpol)", "FitnessVolt", nombre viejo "Tendón Fuerte". Lenguaje de usuario, sin detalles técnicos.
- [Baja] Borrar todos los datos es demasiado directo — ofrecer "Guardar copia antes" o pedir escribir "BORRAR".
- [Baja] Pesas rusas descarta texto sin avisar ("8, 16, abc, 24" → "8, 16, 24"); la tarjeta "Automático" de Pesos queda tapada por la barra de pestañas; el aviso "Máquina agregada" tapa la sección Tema un momento.

---

# Plan de implementación

Cada punto lo implementa un agente nuevo, en orden. Al terminar, el agente marca el punto con ✅ y una línea de lo hecho.

✅ 1. **Validación de datos (alta y Ajustes)** — rangos de peso (30–250), edad (12–100), altura razonable; mancuernas mín ≤ máx y salto > 0; error en rojo debajo del campo con borde y foco (no aviso arriba); mantener el último valor válido en Ajustes; "(opcional)" en Nombre/Altura/Edad; pesas rusas avisa valores ignorados; "Guardado ✓" chiquito al cambiar perfil/equipo. — Hecho en 1.30.0: rangos validados en el lugar (borde rojo, mensaje debajo y foco), último valor válido en Ajustes, "Guardado ✓", aviso de pesas rusas y "(opcional)".
✅ 2. **Sin equipo** — opción "Solo peso corporal" en Equipo (alta y Ajustes) que arme el plan con ejercicios sin material, o frenar en el paso Equipo con aviso claro si no hay nada. — Hecho en 1.30.1: casilla "Solo peso corporal" en Equipo (alta y Ajustes) y 13 ejercicios sin material con dibujo, así todo plan se arma completo sin equipo.
✅ 3. **Dolor en el alta y acceso al modo dolor** — en "¿Te duele algo?", si marcás una zona, preguntar "¿Activar el cuidado ahora?" (activado por defecto); escala y lado sin preseleccionar (pedirlos); en Hoy la tarjeta "Activar modo dolor" arriba de la rutina; corregir el texto del alta sobre dónde se activa. — Hecho en 1.30.2: "¿Activar el cuidado ahora?" (prendido) al marcar una zona, escala y lado sin preseleccionar y obligatorios, tarjeta "Activar modo dolor" arriba de la rutina en Hoy y texto del alta corregido.
✅ 4. **Avisos (toasts) que no tapan ni arrastran** — cerrar avisos al cambiar de paso/pantalla; no pisar controles (barra de descanso, "+ Agregar ejercicio", botones del ejercicio cambiado, "Cancelar" en Cambiar plan, sección Tema en Ajustes); duración más corta; scroll arriba al navegar entre pasos del alta. — Hecho en 1.30.3: el aviso se ubica donde pisa menos controles y deja pasar los toques, dura 2–4,5 s y se cierra con cualquier toque, al cambiar de pestaña o de paso del alta (que arranca arriba).
✅ 5. **Hoy: ya entrenaste / día de descanso** — tras entrenar: "Hoy ya entrenaste", resumen chico, "Próximo: X, el jueves" secundario y "Entrenar igual" secundario. Si hoy no es día del plan: "Hoy descansás · próximo: X el jueves" con empezar igual como secundario. — Hecho en 1.30.4: "Hoy ya entrenaste" con resumen chico o "Hoy descansás", el próximo entreno chico con su día ("Próximo, el jueves") y "Entrenar igual"/"Empezar igual" como botón secundario.
✅ 6. **Hoy: semana y detalles** — tira Lu–Do con sigla del entreno, hoy resaltado, hechos tildados, tocable para ver qué toca; "N ejercicios · ~45 min"; más aire bajo el título gigante; ocultar "Último" si es hoy; explicar "estimado" una vez; chevron "›" en filas tocables; siglas de días con nombre completo o leyenda (también en el alta). — Hecho en 1.30.5: tira Lu–Do tocable con siglas, hoy marcado y hechos tildados; "~N min" junto al título y más aire; ≈ y una sola explicación de "estimado"; › en filas tocables; sin "Último" si es hoy; leyenda de siglas en alta, Cambiar plan y Ajustes.
✅ 7. **Entreno: no perder el entreno en curso** — guardar estado tras cada tilde/cambio y ofrecer "Seguir entreno" al volver (recarga o pestaña descargada). — Hecho en 1.30.6: el entreno se guarda aparte tras cada tilde, dato escrito o cambio; al recargar Hoy muestra "Seguir entreno" con las series hechas y "Descartar" con Deshacer (vence a las 24 h).
✅ 8. **Entreno: descanso y cronómetros** — al tildar, scroll automático a la serie siguiente; margen inferior del alto de la barra de descanso; no iniciar descanso tras la última serie del entreno; duración según ejercicio; cronómetro para ejercicios por tiempo (Plancha); quitar espacio vacío al final. — Hecho en 1.30.7: la serie siguiente se lleva a la vista al tildar, margen del alto de la barra al final, sin descanso tras la última serie (y sí entre ejercicios), descanso según ejercicio (compuesto el elegido, aislamiento 1 min, core 45 s) y cronómetro ▶ con 5 s de preparación en las series por tiempo.
✅ 9. **Entreno: arranque y carga** — serie 1 visible al empezar (plegar entrada en calor, "Pesos estimados" y explicación de RIR); tildar sin cargar: mostrar el valor real cargado (no placeholder) o aviso "Anotamos 13 reps". — Hecho en 1.30.8: entrada en calor, explicación de pesos y RIR plegadas (se abren al tocarlas) para ver la serie 1; tildar sin anotar muestra el valor guardado y avisa una vez "Anotamos 9 reps, lo sugerido".
✅ 10. **Resumen del entreno** — mostrar salteados y series sin hacer; confirmar al terminar con series pendientes; para cambios solo por hoy, no sugerir "mismo peso" como si fuera el original y aclarar qué pasa con el original; récords redondeados y sin sigla sin explicar ("1RM estimado"). — Hecho en 1.30.9: confirmación propia al terminar con series pendientes, "Quedó sin hacer" (salteados y series) y "Solo por hoy" en el resumen sin sugerir "mismo peso", y récords en kilos enteros con "máximo estimado" explicado.
✅ 11. **Selector de ejercicios** — buscador fijo arriba; marcar "Ya está en este día" / evitar duplicados; encabezado con fondo sólido al scrollear. — Hecho en 1.30.10: buscador fijo arriba (sin tildes ni mayúsculas, oculta grupos vacíos y avisa si no hay nada), "✓ Ya está en este día" sin poder agregarlo de nuevo y encabezado con fondo sólido.
✅ 12. **Editar rutina: claridad** — explicar que series/reps los ajusta la app (o permitir editarlos, lo que encaje con el motor de planes); "Exige rodilla/hombro…" solo con modo dolor activo; "Volver al plan original" con diálogo propio que aclare el alcance; "+ Agregar máquina" desde "Nuevo ejercicio". — Hecho en 1.30.11: aviso de que series y reps las ajusta la app (en Editar rutina y Nuevo ejercicio), "Exige…" solo con modo dolor, diálogo propio para "Volver al plan original" (todos los días, con Deshacer) y "+ Agregar máquina" dentro de Nuevo ejercicio.
✅ 13. **Cambiar plan y días** — "Vuelve con los cambios que le hiciste" solo si de verdad hay cambios (y cuáles); días tocables desde la tarjeta "Tu plan"; con el plan lleno, tocar un día libre mueve ahí el día más cercano. — Hecho en 1.30.12: "Vuelve con tus cambios" solo con cambios reales y diciendo cuáles; días tocables en "Tu plan" (Editar rutina y Ajustes) con Deshacer; con el plan lleno un día libre recibe el entreno más cercano (también en la hoja y el alta).
✅ 14. **Rehab: guardar y cerrar bien** — guardar la sesión al completar la última serie (el registro de dolor queda como paso posterior opcional); pantalla "¡Listo!" con resumen y algo de festejo; en Hoy la tarjeta Mañana/Noche queda con "Noche ✓" y lo próximo; guardar el tiempo real sostenido y avisar si quedó muy corto (no contarla completa). — Hecho en 1.30.13: se guarda al terminar la última serie (dolor opcional después, sobre la misma sesión), "¡Sesión de la noche hecha!" con tilde animado, resumen y lo próximo, tarjeta de Hoy con "Hecha ✓" y lo próximo, y segundos reales (antes de la mitad no cuenta y avisa).
✅ 15. **Dolor: textos y explicaciones** — "¿Cuánto te duele ahora?" cuando no es durante un ejercicio, acceso en la pestaña Dolor; aviso "Cambiamos 2 ejercicios por tu codo (ver por qué)"; en Historial "Registro de dolor — sin hacer" con texto menos de tarea pendiente; aclarar qué valor grafica el dolor por zona. — Hecho en 1.30.14: "¿Cuánto te duele ahora?" (cancelable) y acceso en la pestaña Dolor con el último registro, aviso "Cambiamos N ejercicios por tu codo" con "Ver por qué" en Hoy y Entreno, "Dolor anotado" con su valor en Historial y el gráfico aclara que muestra el más alto del día (y el último al tocarlo).
✅ 16. **Historial: gráfico** — eje Y ajustado al rango real con "kg"; fechas suficientes; resumen "+2 kg en 2 semanas"; etiqueta del punto siempre dentro de la tarjeta (debajo si arriba no entra). — Hecho en 1.30.15: eje de kg en el rango real con marcas redondas y "kg", hasta 4 fechas sin pisarse, resumen "+2 kg en 2 semanas" y etiqueta que se acomoda dentro de la tarjeta (debajo si arriba no entra).
✅ 17. **Historial: récords y detalle** — 🏆 explicado en el detalle ("Remo: 14 kg, nuevo máximo") y sección Récords; detalle "12 kg × 12 reps" o mini tabla kg/reps/RIR; destacar kg o comparación con la vez anterior en vez de "7 ejercicios"; selector de ejercicio ordenado/agrupado; agrupar sesiones por semana con racha. — Hecho en 1.30.16: sección Récords (mejor serie por ejercicio), 🏆 explicado en el detalle y en el ejercicio, tablita kg/reps/RIR, kg levantados con el cambio contra la vez anterior, sesiones por semana con racha y selector agrupado por zona.
✅ 18. **Informe y copias** — "Informe para el fisio" solo con modo dolor (o "Exportar mis entrenos" sin él); aviso "Informe descargado"; período desde la primera sesión; "Copia guardada" + "Última copia: fecha" y recordatorio cada tanto. — Hecho en 1.30.17: "Informe para el fisio" solo con modo dolor y "Exportar mis entrenos" sin él, aviso "Informe descargado", período desde la primera sesión, "Copia guardada" con "Última copia: fecha" y recordatorio en Hoy cada mes ("Ahora no" lo pospone).
✅ 19. **Ajustes: detalles** — Banco: botón "Cambiar ahora" en el aviso; Novedades en lenguaje de usuario (sin Epley, IndexedDB, PWA, créditos técnicos ni nombre viejo); borrar datos ofrece "Guardar copia antes" o pide escribir BORRAR; la tarjeta "Automático" de Pesos no queda tapada por la barra. — Hecho en 1.30.18: "Cambiar ahora" en el aviso del banco (press en banco fijado, con Deshacer), novedades sin términos técnicos ni nombre viejo, diálogo de borrado con "Guardar copia antes" y BORRAR escrito, y la opción de Pesos elegida queda arriba de la barra.
✅ 20. **Tema y accesibilidad** — si el usuario no eligió tema, seguir el del sistema (claro/oscuro); filas de interruptor tocables enteras; reemplazar los confirm() nativos que queden por diálogos de la app. — Hecho en 1.30.19: el tema sigue al del teléfono si no se eligió (los viejos con Oscuro por defecto migran), filas de interruptor tocables enteras y los 9 confirm() pasan a un diálogo propio (#asksheet, ask()).
