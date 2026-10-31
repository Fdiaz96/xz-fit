# Condiciones de salud: qué cambia en el entreno y por qué

Desde la v1.32.0 la persona puede marcar condiciones de salud en Ajustes → Salud (y en el paso del perfil del alta). Los datos están en `CONDITIONS` (`data.js`), las reglas puras en `condRules` y `condRange` (`logic.js`), y la app las usa en `planItem`, `restFor`, `isoRest`, `guessFor`, `calibrate` y `careCard` (`app.js`).

La app **no diagnostica ni da el alta médica**. Toma un criterio conservador y común a las fuentes, y siempre dice que no reemplaza al médico.

## Qué cambia

| id | Condición | Descanso mínimo | Piso de reps | RIR al sugerir peso | Avisos |
|---|---|---|---|---|---|
| `marfan` | Síndrome de Marfan / aorta dilatada | 120 s | 12 | 4 | pesos livianos (12–15 reps sin apretar), no aguantar el aire, nada de cargas máximas ni fallo |
| `eds` | Ehlers-Danlos / hiperlaxitud | 90 s | 10 | 3 | recorrido controlado, sin trabar articulaciones; regla de las 2 horas |
| `hta` | Presión alta | 120 s | 10 | 3 | exhalar al hacer fuerza; parar ante dolor de cabeza, mareo o visión borrosa |
| `soplo` | Soplo o problema de válvula | 90 s | 10 | 3 | confirmar con el cardiólogo; parar ante mareo, falta de aire, palpitaciones o dolor de pecho |
| `tiroides` | Hipo o hipertiroidismo | 90 s | — | 3 | solo con los valores controlados; frecuencia cardíaca, hidratación y calor |
| `embarazo` | Embarazo sin complicaciones | 120 s | 10 | 3 | poder hablar (prueba del habla), respirar parejo, evitar boca arriba desde el 4.º mes, señales de alarma |

- **Combinación:** con varias condiciones manda el valor más exigente de cada campo (máximo descanso, máximo piso, máximo RIR) y se juntan todos los avisos.
- **Descanso:** `restFor(ex) = max(restSecs(ex, prefs.rest), rules.rest)`. El mínimo vale también para el aislamiento, el core y los isométricos de rehabilitación (`isoRest`), y la duración estimada del entreno lo tiene en cuenta. En Ajustes, las fichas por debajo del mínimo quedan desactivadas y se marca el descanso efectivo.
- **Intensidad:** `condRange([lo, hi], min)` sube el rango hasta el piso (6–12 con piso 12 pasa a 12–17). El rango de novato se calcula después, sobre el rango ya subido. El peso sugerido (estimado o calibrado) apunta al centro del rango dejando `rir` repeticiones en reserva, en lugar de las 2 de siempre. La doble progresión usa el mismo rango, así que tampoco empuja al fallo.
- **Ejercicios:** no se quitan ni se cambian (fue la decisión del alcance). En embarazo, los marcados `supine` llevan un aviso en Hoy y en la tarjeta del entreno.

## Investigación y fuentes

### Síndrome de Marfan
- La Marfan Foundation recomienda pesas livianas sin hacer fuerza contenida, más repeticiones con menos peso y frenar antes de la fatiga muscular. Pide evitar lo que obligue a pujar o lleve al agotamiento. [Marfan Foundation, Physical Activity Guidelines (2017)](https://info.marfan.org/hubfs/FINAL%20Physical%20Activity%20Guidelines%2011_17.pdf) · [tabla reproducida en Clin Cardiol](https://pmc.ncbi.nlm.nih.gov/articles/PMC6490791/table/clc22481-tbl-0001)
- Brigham and Women's pide evitar los isométricos intensos, las pruebas de fuerza y la maniobra de Valsalva, porque suben la tensión de la pared aórtica. [Brigham and Women's, Marfan syndrome](https://www.brighamandwomens.org/assets/bwh/patients-and-families/pdfs/general---marfan-syndrome.pdf)
- Marfan Trust: la fuerza pesada, la fuerza contenida prolongada y el HIIT siguen siendo riesgosos por los picos de presión. [Marfan Trust, New exercise recommendations](https://www.marfantrust.org/articles/new-exercise-recommendations)
- Hoy se usan reglas por esfuerzo y no topes de kilos: si salen más de 10–15 repeticiones sin mucho esfuerzo, el peso va bien; si hay que aguantar el aire, es demasiado. [UW Medicine, Guidance for patients with aneurysm or dissection (2024)](https://healthonline.washington.edu/sites/default/files/record_pdfs/Guidance-for-Patients-with-Aneurysm-or-Dissection_07-2024_a11y.pdf)
- La guía ACC/AHA 2022 de enfermedad aórtica dice que la intensidad se individualiza según el diámetro, el crecimiento y otros factores. [Circulation 2022](https://www.ahajournals.org/doi/10.1161/CIR.0000000000001106) · [AHA/ACC Task Force 7 (2015)](https://www.ahajournals.org/doi/pdf/10.1161/CIR.0000000000000243)
- Revisiones: [Jensen 2020](https://onlinelibrary.wiley.com/doi/abs/10.1002/tsm2.185) · [Jouini 2022](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8832740/) · [entrenamiento personal online en Marfan, JAHA](https://www.ahajournals.org/doi/10.1161/JAHA.123.033024)

### Ehlers-Danlos / hiperlaxitud
- Las cargas altas son las que más fuerza dan, pero en general se consideran poco adecuadas con dolor e hiperlaxitud. Conviene empezar moderado y progresar despacio. [Zabriskie 2022, revisión narrativa](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9397026/)
- El ensayo Shoulder-MOBILEX prueba cargas pesadas progresivas con supervisión, así que no hay consenso numérico. [protocolo](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7705859/)
- Moverse en un recorrido controlado, sin forzar el final. La "regla de las 2 horas": la molestia tiene que volver a lo habitual en unas 2 h, y hace falta más recuperación entre sesiones. [Russek, Hypermobility 104](https://webspace.clarkson.edu/~lrussek/docs/hypermobility/Russek_HSD104.pdf)

### Presión alta
- ACSM: la fuerza como complemento del aeróbico, al 60–70 % (u 80 %) de 1RM, 2–4 series de 8–12 repeticiones, 2–3 días por semana, subiendo de a poco. [ACSM, Exercise for hypertension](https://acsm.org/exercise-for-the-prevention-and-treatment-of-hypertension/) · [ACSM handout 2025](https://www.acsm.org/wp-content/uploads/2025/02/Exercising-Your-Way-to-Lowering-Your-Blood-Pressure-handout.pdf)
- Respirar sin aguantar el aire (exhalar en el esfuerzo) es la indicación habitual. El ACSM–ESSA propone medir la intensidad por esfuerzo (RIR) y no por %1RM. [ACSM–ESSA 2024](https://www.jsams.org/article/S1440-2440(24)00559-0/fulltext)

### Soplo / valvulopatía
- Un soplo inocente no limita; uno por valvulopatía depende de la gravedad y lo decide el cardiólogo. Mientras tanto, la app aplica el criterio cardiovascular moderado. [AHA, actualización sobre entrenamiento de fuerza (ACC)](https://www.acc.org/Latest-in-Cardiology/ten-points-to-remember/2023/12/19/15/33/resistance-exercise-training) · [Cleveland Clinic, aortic stenosis and exercise](https://health.clevelandclinic.org/aortic-stenosis-and-exercise)

### Tiroides
- Con la tiroides descontrolada, el esfuerzo es riesgoso: el hipertiroidismo sube la frecuencia cardíaca y el calor corporal, y el hipotiroidismo baja la frecuencia cardíaca. Conviene entrenar fuerte solo con los valores controlados. [Cleveland Clinic, uncontrolled thyroid](https://health.clevelandclinic.org/uncontrolled-thyroid-exercise-diet-risks)
- Con el hipotiroidismo controlado, la fuerza moderada mejora la calidad de vida. [ECA en hipotiroidismo subclínico](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10118651/)

### Embarazo
- ACOG: en un embarazo sin complicaciones se recomienda el aeróbico y la fuerza. 10 de 12 sociedades piden evitar estar boca arriba después del 1.er trimestre por la compresión de la vena cava. Solo 5 de 12 mencionan la maniobra de Valsalva. [revisión de guías profesionales](https://pmc.ncbi.nlm.nih.gov/articles/PMC8524738/)
- La app toma el "4.º mes" como un punto medio conservador entre el fin del 1.er trimestre y las ~20 semanas que citan algunas fuentes.

## Límites
- La evidencia en Marfan y en EDS es escasa. Los números (120 s, piso de 12, RIR 4) son un criterio conservador, no una dosis validada.
- La app no pregunta la semana de embarazo, el diámetro aórtico ni la gravedad del soplo, así que los avisos piden consultarlo con el médico.
- No se cambian ejercicios. Una mejora futura podría sacar los ejercicios boca arriba en el embarazo o los isométricos largos en Marfan.
