# XZ Fit — entreno con mancuernas y rehabilitación de tendones

<img src="icon-192.png" width="96" alt="Logo de XZ Fit">

Se usa en **https://fdiaz96.github.io/xz-fit/**. Antes se llamaba *Tendón Fuerte* (dirección `…/tendon-fuerte/`, que ya no funciona); los datos guardados se conservan porque el navegador los guarda por sitio y los identificadores internos siguen siendo `tendon-fuerte`.

App web instalable (PWA) para recuperar tendones con isométricos y ganar músculo con mancuernas, pesas rusas y aros.

## Privacidad

- Todos los datos viven **solo en el celular** (IndexedDB). No hay servidor, cuentas ni llamadas externas.
- Copia de seguridad en un archivo JSON desde Ajustes, compartible con el menú Compartir del celular.

## Funciones

Todo el detalle versión por versión está en [CHANGELOG.md](CHANGELOG.md) (también dentro de la app: Ajustes → *Novedades*).

- **Primer uso:** perfil (sexo, peso, altura, edad, experiencia, días y cuáles), equipo y zonas con dolor (opcional).
- **Equipo a medida:** mancuernas (rango o **discos**, con cálculo de pesos posibles y discos por lado), pesas rusas, aros, banco, barra, bandas y **máquinas propias** con su rango de peso.
- **Peso sugerido:** estimación por peso corporal × coeficiente del ejercicio (sexo, experiencia y edad), arranque al 70 %, redondeado a tu equipo. Tres modos: **automático** (por defecto: la primera serie anotada ajusta la estimación de los demás ejercicios), **con calibración** (reps + reps en reserva → 1RM con Epley) o **manual**.
- **Entreno:** **plan Full body 2 días** (Día A / Día B) que rota según el último día hecho y es **editable** (cambiar, ordenar, agregar, ejercicios propios; lo que elegís queda fijo), 49 ejercicios ilustrados, doble progresión **dentro del rango de cada ejercicio** (6–12, 10–15, 12–20), una serie menos las 2 primeras semanas, entrada en calor con series de aproximación, detección de estancamiento y semana de descarga.
- **Modo dolor (lo activa el usuario):** 6 zonas en 3 fases (isométricos → isotónicos lentos → integración), opciones de ejercicio por fase, dolor 0–10 por sesión o en cualquier momento, pregunta "¿cómo amaneció?" y ajuste automático de la carga; en el entreno, tope del 60 % o variante amable.
- **Sesiones:** temporizador de isométricos manos libres, sonidos, voz opcional, pantalla siempre prendida, descanso configurable, resumen con récords y lo que sube la próxima vez.
- **Seguimiento:** tarjeta semanal y racha, historial con gráficos de dolor y de peso, **informe para el fisio** (HTML imprimible).
- **Ilustraciones animadas** propias en SVG con **vista isométrica 3D** (personaje con remera amarilla, contorno limpio, mancuernas bien orientadas y el músculo trabajado en rojo), sin imágenes de terceros.
- **Otros:** recordatorios `.ics`, copia de seguridad JSON, tema oscuro o claro, instalación guiada, funciona sin conexión.

## Fuentes

- Jeremy Ethier con Keith Baar y Coach Q — [It's Weird, But It Re-Builds Your Tendons In 30 Days](https://www.youtube.com/watch?v=GSwL3Lgw6zI).
- Fuente Oswald bajo [SIL Open Font License 1.1](fonts/OFL.txt).

No es un consejo médico: ante dolor agudo, hinchazón o pérdida de fuerza, consultá a un profesional.

## Estructura

| Archivo | Qué tiene |
|---|---|
| `data.js` | Zonas, ejercicios con sus posturas, opciones de rehabilitación, huecos y planes de entreno |
| `logic.js` | Reglas puras: equipo y discos, pesos, calibración, progresión por rango, planes y rotación, modo dolor, estancamiento, semana y racha, calendario |
| `figures.js` | Dibujo y animación de las ilustraciones |
| `app.js` | Pantallas, sesiones, editor de rutina, informe, sonidos y guardado |
| `CHANGELOG.md` | Cambios por versión (se muestra en la app) |
| `sw.js` | Caché para usarla sin conexión |

## Pruebas

```
npm i && npx playwright install chromium
node tests/unit.mjs                       # reglas
python -m http.server 8124 &
node tests/e2e.mjs                        # punta a punta (SHOTS=carpeta guarda capturas)
node tests/icon.mjs                       # regenera los íconos
```
