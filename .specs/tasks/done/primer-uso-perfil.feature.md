---
title: Implementar el primer uso con perfil, equipo y zonas con dolor
status: implementado (retro-documentado)
versions: 1.0.0, 1.10.1
---

## Initial User Prompt

> Retro-documentado: no hay prompt original. Intención reconstruida del CHANGELOG (1.0.0, 1.10.1).

La primera vez que se abre la app, pedir lo mínimo para estimar cargas y armar la rutina: perfil (sexo, peso, altura, edad, experiencia, días por semana y cuáles), equipo y, opcionalmente, zonas con dolor. El modo dolor no se activa solo.

# Description

Asistente de 4 pasos en el diálogo `#onb`, a pantalla completa, que se abre mientras `S.onboarded` sea `false`:

1. **Bienvenida**: logo, ilustración animada, propósito, fuente del protocolo y aviso de privacidad ("tus datos quedan solo en este teléfono").
2. **Perfil**: nombre, sexo (hombre / mujer / prefiero no decir), peso (obligatorio), altura, edad, días por semana (2 o 3), experiencia (3 niveles) y qué días entrena. Al pasar de 2 a 3 días se proponen lunes, miércoles y viernes; con 2, lunes y jueves.
3. **Equipo**: los mismos campos que Ajustes → Equipo (ver [equipo-a-medida](equipo-a-medida.feature.md)).
4. **¿Te duele algo?**: las 6 zonas con interruptor, dolor actual 0–10 y lado. Crea `S.zones[zona]` en fase 1, pero **deja `painMode` apagado**.

Al terminar: `onboarded = true`, `seenVersion = APP_VERSION` (para no mostrar Novedades a quien recién llega), calcula el presupuesto de volumen, guarda y pide almacenamiento persistente.

Fuera de alcance: cuentas, sincronización, importar desde otra app.

## Acceptance Criteria

**Checklist:**
- [x] `CK-1` — Con la base vacía, la app abre `#onb` en el paso de bienvenida.
- [x] `CK-2` — No se puede pasar del paso de perfil sin un peso > 0 (aviso "Poné tu peso para estimar las cargas.").
- [x] `CK-3` — Elegir 3 días propone lu/mi/vi; volver a 2 propone lu/ju; los días se pueden tocar uno por uno.
- [x] `CK-4` — Perfil, equipo y zonas quedan guardados en `S` al terminar.
- [x] `CK-5` — Marcar zonas no activa el modo dolor; Inicio sugiere activarlo con "Activar modo dolor" / "Ahora no".
- [x] `CK-6` — Quien termina el primer uso no ve la tarjeta de Novedades de la versión actual.

**Regular Checks:**
- Todo texto del usuario pasa por `esc()`.
- Los campos usan `data-set` / `data-action`, sin listeners sueltos.
- Los interruptores tienen `aria-label`.

**Rubric:**

| Criterio | Peso | Descripción |
|---|---|---|
| Fricción mínima | 0,4 | Solo el peso es obligatorio; el resto tiene valores por defecto razonables |
| Consentimiento del modo dolor | 0,3 | El usuario decide activarlo; la app solo lo sugiere |
| Coherencia con Ajustes | 0,3 | Mismos campos y misma lógica que la pantalla de Ajustes |

**Rubric Score Definitions:**
- 5: cumple todo el criterio sin excepciones · 3: cumple con desvíos menores · 1: no cumple.

**Test Strategy:**
- e2e `// 1. Primer uso`: bienvenida, peso obligatorio, días propuestos, guardado de perfil/equipo/zonas, modo dolor apagado.
- e2e `// 2.`: sugerencia de modo dolor sin activarlo; sin modo dolor no hay tope del 60 %.

**Definition of Done:**
- Pruebas e2e del primer uso en verde.
- CHANGELOG con la versión correspondiente.

## Architecture Overview

- `app.js`: `renderOnb()`, `onbNext()`, `ONB_STEPS = 4`, acciones `onb-next`, `onb-back`, `set-sex`, `set-exp`, `rem-day`, `zone-toggle`, `zone-pain`, `zone-side`; `newZone()` crea la zona con carga inicial redondeada al equipo.
- Reutiliza `equipFields()` de Ajustes.
- Datos: `S.profile`, `S.rem.train`, `S.equip`, `S.zones`, `S.onboarded`, `S.seenVersion`.

## Implementation Process

Implementado antes de adoptar SDD (versiones 1.0.0 y 1.10.1). Sin sub-tareas.
