/**
 * Plantillas de consentimiento informado que se crean automáticamente para
 * cada clínica la primera vez que abre el módulo (si no tiene ninguna).
 *
 * Marco normativo (Colombia):
 *  - Ley 23 de 1981 (Ética Médica) y Decreto 3380 de 1981 — riesgo previsto y consentimiento.
 *  - Ley 35 de 1989 (Código de Ética del Odontólogo).
 *  - Ley 1751 de 2015 (Estatutaria de Salud) — derecho a información clara.
 *  - Resolución 1995 de 1999 — el consentimiento hace parte de la historia clínica.
 *  - Ley 527 de 1999 y Decreto 2364 de 2012 — firma electrónica.
 *  - Ley 1581 de 2012 y Decreto 1377 de 2013 — protección de datos personales.
 *
 * Formato: `## ` subtítulos, `**negrita**`, `- ` viñetas, párrafos con línea en blanco.
 * Merge tags: {{paciente.nombre}}, {{paciente.documento}}, {{paciente.edad}},
 * {{clinica.nombre}}, {{profesional.nombre}}, {{profesional.registro}}, {{fecha}},
 * {{procedimiento}}.
 */

export interface DefaultConsentTemplate {
  name: string;
  bodyMarkdown: string;
}

/** Encabezado común para consentimientos de procedimientos clínicos. */
function intro(servicio: string): string {
  return `Yo, **{{paciente.nombre}}**, identificado(a) con **{{paciente.documento}}**, de {{paciente.edad}} de edad, actuando en nombre propio o como representante legal del paciente, en pleno uso de mis facultades y de manera libre, consciente y voluntaria, declaro que el(la) profesional **{{profesional.nombre}}**, con registro profesional {{profesional.registro}}, de **{{clinica.nombre}}**, me ha explicado en lenguaje claro y comprensible la información que se consigna en este documento sobre ${servicio}.

**Procedimiento / detalle:** {{procedimiento}}`;
}

/** Declaración del paciente y revocatoria, comunes a los consentimientos clínicos. */
function cierre(opts: { odontologico: boolean; accion: string }): string {
  const ciencia = opts.odontologico ? 'la odontología' : 'la medicina';
  const registro = opts.odontologico
    ? '\n- Autorizo la toma de radiografías, fotografías y modelos de estudio con fines diagnósticos y de seguimiento, que harán parte de mi historia clínica y serán tratados con confidencialidad.'
    : '';
  return `## Declaración del paciente

- He informado de manera completa y veraz mis antecedentes médicos y odontológicos, alergias, medicamentos que tomo, enfermedades (como diabetes, hipertensión, problemas de coagulación o del corazón) y, si aplica, la posibilidad de embarazo o lactancia. Entiendo que ocultar información puede aumentar los riesgos.
- Se me explicaron la naturaleza y el propósito del procedimiento, sus beneficios, riesgos, complicaciones posibles y las alternativas disponibles, incluida la de no realizar ningún tratamiento.
- Tuve la oportunidad de hacer preguntas y todas fueron resueltas de manera satisfactoria.
- Entiendo que ${ciencia} no es una ciencia exacta y que no se me ha garantizado un resultado determinado. El profesional se compromete a emplear todos los medios técnicos y científicos a su alcance (obligación de medio), y su responsabilidad no irá más allá del riesgo previsto que aquí se me ha advertido (Ley 23 de 1981, art. 16).
- Autorizo al profesional para que, si durante el procedimiento surge una situación imprevista, adopte las medidas que considere necesarias en beneficio de mi salud, informándome de ellas tan pronto sea posible.${registro}
- Me comprometo a seguir las indicaciones y cuidados posteriores, a tomar los medicamentos formulados y a asistir a los controles programados.
- Si el paciente es menor de edad o no está en capacidad de decidir, firma su representante legal o acudiente, quien declara haber recibido esta misma información.

En consecuencia, **otorgo mi consentimiento** para ${opts.accion}.

## Revocatoria

Sé que puedo **revocar este consentimiento en cualquier momento** antes de la realización del procedimiento, sin necesidad de justificar mi decisión y sin que ello afecte la atención que se me brinde. La revocatoria debe quedar por escrito en mi historia clínica. Si decido suspender el tratamiento una vez iniciado, el profesional me informará los riesgos de interrumpirlo.

Este documento hace parte de mi historia clínica (Resolución 1995 de 1999) y se firma electrónicamente con plena validez legal (Ley 527 de 1999), el {{fecha}}.`;
}

// ────────────────────────────────────────────────────────────────────────────
// 1) General odontológico
// ────────────────────────────────────────────────────────────────────────────
const GENERAL_ODONTOLOGICO = `${intro('la atención odontológica general')}

## 1. Descripción del procedimiento

La atención odontológica general comprende la valoración clínica, el diagnóstico y los tratamientos básicos que se derivan de ella, entre otros:

- Examen clínico de dientes, encías, lengua, mucosas y articulación temporomandibular.
- Toma de radiografías intraorales o panorámicas, cuando sean necesarias para el diagnóstico.
- Profilaxis (limpieza), detartraje (retiro de cálculos o sarro), aplicación de flúor y sellantes.
- Restauraciones (calzas) en resina u otros materiales para tratar caries o fracturas.
- Aplicación de **anestesia local** cuando el procedimiento lo requiera.

El plan de tratamiento, el número de citas y su costo me serán explicados antes de iniciar.

## 2. Beneficios esperados

- Diagnóstico oportuno de caries, enfermedad de las encías y otras alteraciones de la boca.
- Eliminación de focos de infección y del dolor.
- Recuperación de la función masticatoria y de la estética dental.
- Prevención de complicaciones y de tratamientos más complejos en el futuro.

## 3. Riesgos y complicaciones frecuentes

- **Sensibilidad** dental al frío, al calor o al masticar después de una restauración o de una limpieza profunda, que suele desaparecer en días o semanas.
- Molestias, **dolor leve o inflamación** de las encías después del tratamiento.
- Por la anestesia local: adormecimiento temporal del labio, la lengua o la mejilla; hematoma o dolor en el sitio de la punción; mareo o palpitaciones pasajeras. Con muy poca frecuencia, reacción alérgica o alteración de la sensibilidad (parestesia) que puede tardar semanas en recuperarse.
- Mordedura involuntaria del labio o la lengua mientras dura el efecto de la anestesia.
- Cansancio o molestia en la articulación de la mandíbula por mantener la boca abierta.
- Fractura o desgaste de restauraciones con el tiempo, que pueden requerir reparación o cambio.
- Cuando la caries es profunda, puede aparecer dolor o inflamación del nervio que obligue a realizar un **tratamiento de conductos (endodoncia)** o, en casos extremos, la extracción del diente.

Las radiografías se toman con la menor dosis posible de radiación y con protección; debo informar si existe posibilidad de embarazo.

## 4. Alternativas

Según mi caso, se me explicaron alternativas como otros materiales de restauración, tratamientos más o menos conservadores, la remisión a un especialista o no realizar el tratamiento. Entiendo que no tratar la caries o la enfermedad de las encías puede producir dolor, infección, pérdida de dientes y afectar mi salud general.

## 5. Cuidados posteriores

- No comer ni tomar bebidas calientes mientras persista el adormecimiento de la anestesia.
- Evitar alimentos muy duros sobre las restauraciones recién hechas durante las primeras 24 horas.
- Cepillarme después de cada comida, usar seda dental y crema con flúor.
- Tomar únicamente los medicamentos formulados por el profesional.
- Consultar si el dolor aumenta, si hay inflamación, fiebre o si la mordida se siente alta.
- Asistir a los controles periódicos (por lo menos cada seis meses).

${cierre({ odontologico: true, accion: 'que se me realice la valoración y el tratamiento odontológico descrito' })}`;

// ────────────────────────────────────────────────────────────────────────────
// 2) Exodoncia simple y quirúrgica
// ────────────────────────────────────────────────────────────────────────────
const EXODONCIA = `${intro('la exodoncia (extracción dental)')}

## 1. Descripción del procedimiento

La exodoncia consiste en retirar uno o varios dientes de su alvéolo (el hueso que los sostiene), bajo **anestesia local**.

- **Exodoncia simple:** el diente se afloja y se retira con instrumentos especiales (elevadores y fórceps), sin necesidad de cortar la encía.
- **Exodoncia quirúrgica:** se utiliza cuando el diente está incluido, retenido (por ejemplo, las cordales o terceros molares), fracturado o tiene raíces complejas. Requiere una incisión en la encía, retirar parte del hueso que lo rodea y, en ocasiones, dividir el diente en fragmentos. Al final se sutura (se ponen puntos).

Antes del procedimiento se me solicitaron las radiografías necesarias para planear la cirugía.

## 2. Beneficios esperados

- Eliminar el dolor y los focos de infección causados por el diente.
- Prevenir complicaciones como abscesos, quistes, daño a dientes vecinos o enfermedad de las encías.
- Crear espacio o condiciones necesarias para un tratamiento de ortodoncia o de rehabilitación con prótesis o implantes.

## 3. Riesgos y complicaciones frecuentes

- **Dolor, inflamación** de la cara y **sangrado** leve durante las primeras 24 a 72 horas.
- **Hematoma o morado** en la piel de la cara o el cuello, que desaparece en pocos días.
- **Trismus:** dificultad temporal para abrir la boca.
- **Alveolitis seca:** dolor intenso a partir del tercer día por pérdida del coágulo; requiere curaciones.
- **Infección** de la herida, que puede requerir antibióticos o drenaje.
- Heridas o quemaduras leves en las comisuras de los labios por la separación durante el procedimiento.

**Riesgos menos frecuentes**, que pueden ser más serios:

- Lesión del nervio dentario inferior o del nervio lingual (especialmente en cordales inferiores), con **adormecimiento u hormigueo del labio, el mentón o la lengua**. Suele ser temporal (semanas o meses), pero excepcionalmente puede ser permanente.
- **Comunicación con el seno maxilar** al extraer molares superiores, que puede requerir cierre quirúrgico.
- **Fractura de la raíz:** en algunos casos, dejar un pequeño fragmento es más seguro que retirarlo; el profesional me lo informará.
- Daño a dientes vecinos o a sus restauraciones; fractura del hueso alveolar y, de manera excepcional, fractura de la mandíbula.
- Desplazamiento de un diente o raíz hacia tejidos vecinos; luxación de la articulación de la mandíbula.
- Sangrado prolongado, en especial si tomo anticoagulantes o tengo alteraciones de la coagulación.

## 4. Alternativas

Según mi caso, se me explicaron alternativas como el tratamiento de conductos (endodoncia), el tratamiento periodontal, la observación con controles radiográficos periódicos o no realizar la extracción. Entiendo que no extraer el diente cuando está indicado puede causar dolor, infección, quistes, daño a dientes vecinos y complicaciones de mayor gravedad.

## 5. Cuidados posteriores

- **Morder la gasa** con firmeza durante 30 a 45 minutos.
- Durante las primeras 24 horas: no escupir, no hacer enjuagues fuertes y **no tomar líquidos con pitillo**.
- **No fumar ni consumir bebidas alcohólicas** durante al menos 72 horas.
- Aplicar **hielo o compresas frías** por fuera de la cara (20 minutos sí, 20 minutos no) durante las primeras 24 a 48 horas.
- Dieta **blanda y fría o tibia** los primeros días; masticar por el lado contrario.
- Dormir con la cabeza elevada y evitar el ejercicio intenso durante 48 horas.
- Tomar los medicamentos formulados en los horarios indicados.
- Cepillar con suavidad los demás dientes desde el día siguiente, sin tocar la herida.
- Asistir al retiro de puntos, generalmente entre 7 y 10 días después.
- **Consultar de inmediato** si hay sangrado abundante que no cede con presión, fiebre, dificultad para tragar o respirar, o dolor que aumenta después del tercer día.

${cierre({ odontologico: true, accion: 'que se me realice la exodoncia descrita, simple o quirúrgica según lo requiera mi caso' })}`;

// ────────────────────────────────────────────────────────────────────────────
// 3) Endodoncia
// ────────────────────────────────────────────────────────────────────────────
const ENDODONCIA = `${intro('el tratamiento de conductos (endodoncia)')}

## 1. Descripción del procedimiento

La endodoncia consiste en retirar la **pulpa dental** (el "nervio") cuando está inflamada, infectada o necrótica. Bajo **anestesia local** y con aislamiento con dique de goma, se abre el diente, se limpian, conforman y desinfectan los conductos radiculares y, finalmente, se sellan con un material biocompatible (gutapercha y cemento sellador).

- Puede realizarse en **una o varias citas**, según la complejidad y el grado de infección.
- Se toman varias radiografías durante el tratamiento para controlar cada etapa.
- Al terminar, el diente queda con una obturación provisional. Para protegerlo es indispensable una **restauración definitiva** (resina, incrustación o corona), porque un diente tratado se vuelve más frágil.

## 2. Beneficios esperados

- Eliminar el dolor y la infección.
- **Conservar el diente natural** en lugar de extraerlo, manteniendo la función masticatoria y la estética.
- Evitar que la infección se extienda al hueso y a otros tejidos.

La endodoncia tiene una alta tasa de éxito, pero no es posible garantizarla en todos los casos.

## 3. Riesgos y complicaciones frecuentes

- **Dolor o sensibilidad al masticar** durante algunos días después de cada cita; en ocasiones, inflamación que requiere medicación adicional.
- Dificultad para lograr una anestesia completa cuando el diente está muy inflamado.
- **Fractura de un instrumento** dentro del conducto, que en algunos casos no puede retirarse.
- Conductos calcificados, muy curvos o no localizables que impidan completar el tratamiento de forma convencional.
- **Perforación** de la raíz o paso de material de sellado más allá de la punta de la raíz.
- **Fractura del diente**, en especial si no se coloca a tiempo la restauración definitiva.
- Cambio de color (oscurecimiento) del diente con el tiempo.
- Persistencia o reaparición de la infección, que puede requerir un **retratamiento**, una cirugía de la punta de la raíz (apicectomía) o, finalmente, la **extracción** del diente.

## 4. Alternativas

Se me explicó que la alternativa principal es la **extracción del diente** y su posterior reemplazo con un implante, un puente fijo o una prótesis removible. También se me informó que no realizar ningún tratamiento puede causar dolor, abscesos, pérdida de hueso, pérdida del diente e incluso la diseminación de la infección.

## 5. Cuidados posteriores

- No masticar con el diente tratado hasta que tenga la restauración definitiva.
- Si la obturación provisional se cae o se desgasta, avisar de inmediato.
- Tomar los medicamentos formulados (analgésicos y, si aplica, antibióticos).
- Mantener una higiene cuidadosa del diente y de la zona.
- Realizar la **restauración definitiva** en el plazo indicado por el profesional.
- Consultar si aparece inflamación en la cara, fiebre o dolor intenso que no cede con la medicación.
- Asistir a los controles radiográficos que se programen.

${cierre({ odontologico: true, accion: 'que se me realice el tratamiento de conductos descrito' })}`;

// ────────────────────────────────────────────────────────────────────────────
// 4) Implante dental
// ────────────────────────────────────────────────────────────────────────────
const IMPLANTE = `${intro('la colocación de implantes dentales')}

## 1. Descripción del procedimiento

Un implante dental es un pequeño tornillo de titanio (u otro material biocompatible) que se coloca quirúrgicamente en el hueso maxilar o mandibular, bajo **anestesia local**, para reemplazar la raíz de un diente perdido.

- **Fase quirúrgica:** se abre la encía, se prepara el hueso y se inserta el implante; luego se sutura.
- **Oseointegración:** durante un período aproximado de **3 a 6 meses** el hueso se une al implante. En este tiempo puede usarse una prótesis provisional.
- **Fase protésica:** se coloca el pilar y la corona, puente o prótesis definitiva sobre el implante.
- Según la cantidad y calidad del hueso, puede ser necesario un **injerto óseo**, regeneración con membranas o una **elevación del piso del seno maxilar**, lo que me será explicado previamente.

Antes de la cirugía se realizaron los estudios necesarios (radiografía panorámica y/o tomografía, y exámenes de laboratorio cuando están indicados).

## 2. Beneficios esperados

- Reemplazar dientes perdidos con una solución fija, estable y de aspecto natural.
- Recuperar la función masticatoria, la fonación y la estética de la sonrisa.
- Evitar el desgaste de los dientes vecinos que requiere un puente convencional.
- Ayudar a conservar el hueso de la zona donde falta el diente.

## 3. Riesgos y complicaciones frecuentes

- **Dolor, inflamación, hematoma** y sangrado leve durante los primeros días.
- **Infección** de la zona intervenida.
- **Falta de oseointegración:** el implante puede no unirse al hueso y ser necesario retirarlo y, cuando sea posible, colocarlo de nuevo después de un tiempo.
- Lesión del nervio dentario inferior con **adormecimiento u hormigueo del labio o el mentón**, temporal o, excepcionalmente, permanente.
- **Comunicación con el seno maxilar o las fosas nasales** en implantes superiores.
- Retracción de la encía o resultado estético diferente al esperado, en especial en la zona anterior.
- A largo plazo: **periimplantitis** (inflamación e infección alrededor del implante con pérdida de hueso), aflojamiento o fractura de tornillos, coronas u otros componentes.

Se me informó que el **tabaquismo**, la diabetes no controlada, el bruxismo (apretar o rechinar los dientes), la osteoporosis tratada con bifosfonatos, la radioterapia de cabeza y cuello y la higiene deficiente **aumentan de manera importante el riesgo de fracaso**.

## 4. Alternativas

Se me explicaron alternativas como el **puente fijo** sobre dientes naturales, la **prótesis removible** (parcial o total) o no reemplazar el diente, con sus respectivas ventajas y desventajas. Entiendo que no reemplazar los dientes perdidos puede producir movimiento de los dientes vecinos, pérdida de hueso y alteraciones en la mordida.

## 5. Cuidados posteriores

- Aplicar **frío local** durante las primeras 24 a 48 horas y mantener la cabeza elevada.
- Dieta **blanda** y evitar masticar sobre la zona del implante hasta que el profesional lo autorice.
- **No fumar**, idealmente durante todo el proceso de cicatrización y oseointegración.
- No usar prótesis removibles sobre la zona operada sin autorización.
- Realizar los enjuagues (por ejemplo, con clorhexidina) y tomar los medicamentos formulados.
- Mantener una higiene rigurosa de por vida y asistir a los **controles y mantenimientos periódicos**, que son indispensables para la duración del implante.

Se me informaron el costo del tratamiento, su duración aproximada y la posible necesidad de procedimientos adicionales.

${cierre({ odontologico: true, accion: 'que se me coloque el implante o los implantes dentales descritos y se realicen los procedimientos complementarios que se requieran' })}`;

// ────────────────────────────────────────────────────────────────────────────
// 5) Blanqueamiento dental
// ────────────────────────────────────────────────────────────────────────────
const BLANQUEAMIENTO = `${intro('el blanqueamiento dental')}

## 1. Descripción del procedimiento

El blanqueamiento dental aclara el color de los dientes mediante geles a base de **peróxido de hidrógeno o peróxido de carbamida**, que actúan sobre los pigmentos del esmalte y la dentina.

- **En consultorio:** se protegen las encías con una barrera y se aplica el gel en una o varias sesiones, con o sin activación con luz.
- **En casa:** se usan férulas (cubetas) hechas a la medida con un gel de menor concentración, durante el tiempo que indique el profesional.
- Antes de iniciar se realiza una valoración y, si es necesario, una limpieza. Las caries y la enfermedad de las encías deben tratarse primero.

El blanqueamiento **no cambia el color de resinas, coronas, carillas ni prótesis**, que podrían requerir cambio para igualar el nuevo tono. El resultado depende de cada persona, no es igual en todos los dientes y **no es permanente**: se mantiene de uno a tres años según los hábitos.

## 2. Beneficios esperados

- Dientes más claros y una sonrisa más estética.
- Procedimiento conservador que no desgasta la estructura del diente.

## 3. Riesgos y complicaciones frecuentes

- **Sensibilidad dental** al frío o al calor durante el tratamiento y hasta algunos días después; es la molestia más frecuente y es transitoria.
- **Irritación o enrojecimiento de las encías** o de los labios por contacto con el gel.
- Manchas blancas temporales o tono desigual entre dientes.
- Diferencia de color con restauraciones existentes, que puede requerir su reemplazo con costo adicional.
- Regreso gradual del color (recidiva), en especial con el consumo de café, té, vino, cigarrillo o bebidas oscuras.
- Resultado menor al esperado en manchas por tetraciclinas, fluorosis severa o dientes con tratamiento de conductos.

No se recomienda durante el **embarazo o la lactancia**, en menores de edad sin valoración específica, ni con caries activas o encías inflamadas.

## 4. Alternativas

Se me explicaron alternativas como la profilaxis (limpieza profesional), la microabrasión del esmalte, las carillas de resina o porcelana, las coronas o no realizar ningún tratamiento.

## 5. Cuidados posteriores

- Seguir una **"dieta blanca"** durante 48 a 72 horas: evitar café, té, vino tinto, gaseosas oscuras, salsas, colorantes y cigarrillo.
- Usar crema dental para dientes sensibles o el gel desensibilizante indicado.
- En el blanqueamiento en casa: usar las férulas solo el tiempo indicado y no exceder la cantidad de gel.
- Suspender y consultar si la sensibilidad es intensa o aparece irritación persistente.
- Mantener una buena higiene y las limpiezas periódicas para prolongar el resultado.

${cierre({ odontologico: true, accion: 'que se me realice el blanqueamiento dental descrito' })}`;

// ────────────────────────────────────────────────────────────────────────────
// 6) Ortodoncia
// ────────────────────────────────────────────────────────────────────────────
const ORTODONCIA = `${intro('el tratamiento de ortodoncia')}

## 1. Descripción del procedimiento

La ortodoncia corrige la posición de los dientes y la relación entre los maxilares mediante aparatos que aplican fuerzas suaves y controladas:

- **Aparatología fija** (brackets metálicos o estéticos adheridos a los dientes y arcos), **aparatos removibles** o **alineadores transparentes**, según el plan acordado.
- Los **controles** se realizan aproximadamente cada 4 a 6 semanas.
- La duración estimada es de **18 a 36 meses**, pero depende de la complejidad del caso, de la respuesta biológica y de mi colaboración (asistencia a citas, higiene y uso de elásticos o aparatos).
- En algunos casos se requieren **extracciones** de dientes, microtornillos de anclaje, elásticos o la combinación con cirugía de los maxilares (cirugía ortognática).
- Al terminar sigue la **fase de retención** con retenedores fijos y/o removibles, que deben usarse por tiempo prolongado, incluso de manera indefinida.

Antes de iniciar se realizaron los registros diagnósticos (radiografías, fotografías y modelos o escaneo).

## 2. Beneficios esperados

- Dientes alineados y una mordida funcional.
- Mejor masticación y distribución de las fuerzas sobre los dientes y la articulación.
- Mayor facilidad para la higiene, lo que ayuda a prevenir caries y enfermedad de las encías.
- Mejora de la estética de la sonrisa y del perfil facial.

## 3. Riesgos y complicaciones frecuentes

- **Molestias o dolor** durante los primeros días después de la instalación y de cada control.
- **Llagas o úlceras** en labios, mejillas o lengua por el roce de los aparatos.
- **Manchas blancas (descalcificación) y caries** alrededor de los brackets si la higiene es deficiente.
- **Inflamación de las encías** y, en algunos casos, retracción gingival.
- **Reabsorción radicular:** acortamiento de las raíces de algunos dientes, generalmente leve.
- Molestias en la articulación temporomandibular.
- **Recidiva:** los dientes tienden a volver a su posición inicial si no se usan los retenedores como se indica.
- Prolongación del tratamiento por inasistencia a controles, daño o desprendimiento de los aparatos o por falta de colaboración.
- En dientes con traumas o restauraciones grandes previas, posible pérdida de vitalidad del nervio.

## 4. Alternativas

Se me explicaron alternativas como otros tipos de aparatología (fija, removible o alineadores), tratamientos restauradores (carillas o coronas) para casos leves, la ortodoncia combinada con cirugía ortognática o no realizar el tratamiento, entendiendo sus limitaciones y consecuencias.

## 5. Cuidados posteriores

- Cepillarme **después de cada comida** con cepillo de ortodoncia, usar seda dental con enhebrador y cepillos interproximales.
- Usar crema dental con flúor y los enjuagues indicados.
- **Evitar alimentos duros o pegajosos** (hielo, bombones, chicle, maíz pira, turrones) y cortar en trozos pequeños alimentos como la manzana o la zanahoria.
- No morder objetos (lapiceros, uñas).
- Usar los elásticos o aparatos exactamente como se indique.
- Asistir puntualmente a los controles y avisar si un bracket se despega o un alambre lastima.
- Al terminar, **usar los retenedores** según las instrucciones para conservar el resultado.

${cierre({ odontologico: true, accion: 'que se me realice el tratamiento de ortodoncia descrito, con los ajustes que requiera su evolución' })}`;

// ────────────────────────────────────────────────────────────────────────────
// 7) Tratamiento de datos personales (Habeas Data)
// ────────────────────────────────────────────────────────────────────────────
const HABEAS_DATA = `Yo, **{{paciente.nombre}}**, identificado(a) con **{{paciente.documento}}**, actuando en nombre propio o como representante legal del titular, autorizo de manera **previa, expresa e informada** a **{{clinica.nombre}}** para tratar mis datos personales conforme a la **Ley 1581 de 2012**, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y su política de tratamiento de la información.

## 1. Responsable del tratamiento

**{{clinica.nombre}}**, que recolecta, almacena, usa, circula y suprime los datos personales de sus pacientes. Puede apoyarse en **encargados** (proveedores de software de historia clínica en la nube, mensajería, facturación electrónica y almacenamiento), que están obligados a mantener la seguridad y confidencialidad de la información y cuyos servidores pueden estar ubicados dentro o fuera de Colombia, en países con niveles adecuados de protección.

## 2. Datos que se recolectan

- **Datos de identificación y contacto:** nombre, documento, fecha de nacimiento, sexo, dirección, teléfono, correo electrónico y datos del acudiente o contacto de emergencia.
- **Datos de afiliación:** EPS, medicina prepagada o aseguradora.
- **Datos sensibles de salud:** antecedentes, diagnósticos, tratamientos, radiografías, fotografías clínicas, resultados de exámenes y demás información de la historia clínica.
- **Datos biométricos:** firma manuscrita digitalizada y, cuando aplique, imágenes del rostro o de la boca con fines clínicos.

## 3. Finalidades

- Prestar los servicios de salud solicitados: valoración, diagnóstico, tratamiento, seguimiento y controles.
- Elaborar, custodiar y conservar la **historia clínica** durante el tiempo que exige la ley (Resolución 1995 de 1999 y Resolución 839 de 2017).
- Agendar citas y enviar **recordatorios y confirmaciones** por WhatsApp, mensaje de texto, correo electrónico o llamada.
- Facturar, gestionar pagos y cartera, y tramitar autorizaciones ante EPS o aseguradoras.
- Reportar la información exigida por las autoridades de salud (por ejemplo, RIPS) y atender requerimientos de autoridades competentes.
- Realizar encuestas de satisfacción y enviar información sobre cuidados, campañas de salud y servicios de la clínica. Puedo pedir en cualquier momento que no se me envíe información comercial.

## 4. Datos sensibles y de menores de edad

Se me informó que los **datos de salud son sensibles** y que **no estoy obligado(a) a autorizar su tratamiento**; sin embargo, entiendo que son indispensables para prestarme una atención segura y para cumplir la obligación legal de llevar la historia clínica. Los datos de niños, niñas y adolescentes se tratarán respetando su interés superior y sus derechos fundamentales.

## 5. Derechos del titular

Como titular de los datos tengo derecho a:

- **Conocer, actualizar y rectificar** mis datos personales.
- Solicitar prueba de esta autorización.
- Ser informado(a) sobre el uso que se ha dado a mis datos.
- **Revocar la autorización** y/o solicitar la **supresión** de mis datos, salvo cuando exista un deber legal o contractual de conservarlos, como ocurre con la historia clínica.
- Acceder de forma **gratuita** a mis datos personales.
- Presentar quejas ante la **Superintendencia de Industria y Comercio** por infracciones a la ley, después de haber agotado el trámite ante el responsable.

Las **consultas** se atenderán en un plazo máximo de 10 días hábiles y los **reclamos** en un máximo de 15 días hábiles, prorrogables en los términos de la ley, a través de los canales de atención de {{clinica.nombre}} (presencial, telefónico o correo electrónico).

## 6. Declaración y autorización

Declaro que se me informó de manera clara sobre el responsable, las finalidades, el carácter facultativo de responder preguntas sobre datos sensibles o de menores y mis derechos como titular, y que la información que suministro es veraz y completa. En consecuencia, **autorizo el tratamiento de mis datos personales** para las finalidades aquí descritas.

## 7. Revocatoria

Puedo revocar esta autorización o solicitar la supresión de mis datos en cualquier momento mediante solicitud a los canales de atención de la clínica. La revocatoria no procede respecto de la información que deba conservarse por mandato legal, como la historia clínica, ni afecta la validez del tratamiento realizado antes de la revocatoria.

Esta autorización se firma electrónicamente con plena validez legal (Ley 527 de 1999), el {{fecha}}.`;

// ────────────────────────────────────────────────────────────────────────────
// 8) Consulta médica general
// ────────────────────────────────────────────────────────────────────────────
const CONSULTA_MEDICA = `${intro('la consulta de medicina general')}

## 1. Descripción del procedimiento

La consulta médica general comprende:

- **Entrevista clínica (anamnesis):** preguntas sobre el motivo de consulta, síntomas, antecedentes personales y familiares, medicamentos, alergias y hábitos.
- **Examen físico:** toma de signos vitales (presión arterial, pulso, temperatura, peso, talla) e inspección, palpación, percusión y auscultación de las partes del cuerpo necesarias para el diagnóstico. Puede requerir descubrir algunas zonas del cuerpo, siempre con **respeto por mi intimidad**; tengo derecho a estar acompañado(a) durante el examen.
- **Impresión diagnóstica** y explicación de los hallazgos.
- **Plan de manejo:** formulación de medicamentos, recomendaciones, órdenes de laboratorio o de imágenes diagnósticas, incapacidades o remisión a especialistas cuando se requiera.
- Cuando esté indicado, **procedimientos menores** en el consultorio (curaciones, aplicación de medicamentos inyectados, retiro de puntos), que me serán explicados antes de realizarlos.

## 2. Beneficios esperados

- Identificar oportunamente la causa de mis síntomas o problemas de salud.
- Recibir un tratamiento adecuado y recomendaciones para mejorar o conservar mi salud.
- Prevenir enfermedades y complicaciones mediante la educación y la detección temprana.

## 3. Riesgos y complicaciones frecuentes

- El examen físico puede producir **molestias leves** y transitorias (por ejemplo, al palpar una zona dolorosa).
- Los medicamentos formulados pueden causar **efectos secundarios** (malestar estomacal, somnolencia, mareo, entre otros) y, con poca frecuencia, **reacciones alérgicas**, que pueden ser graves en personas sensibles.
- Los procedimientos menores pueden ocasionar dolor, sangrado leve, hematoma, infección local o reacción en el sitio de la aplicación.
- El diagnóstico depende en parte de la información que yo suministre; algunas enfermedades requieren **exámenes adicionales, varias consultas o valoración por especialista** para confirmarse.

## 4. Alternativas

Se me informó que puedo no aceptar el examen o el tratamiento propuesto, solicitar una segunda opinión o ser atendido(a) por otro profesional. Entiendo que no recibir atención o no seguir el tratamiento puede retrasar el diagnóstico y empeorar mi condición.

## 5. Cuidados posteriores

- Tomar los medicamentos **exactamente como fueron formulados**, sin automedicarme ni suspenderlos sin indicación.
- Realizar los exámenes ordenados y asistir a los controles programados.
- Informar cualquier reacción inesperada a los medicamentos.
- Acudir de inmediato al servicio de **urgencias** si presento signos de alarma, como dificultad para respirar, dolor en el pecho, fiebre persistente, sangrado, desmayo o empeoramiento marcado de los síntomas.

${cierre({ odontologico: false, accion: 'que se me realice la consulta de medicina general, el examen físico y los procedimientos descritos' })}`;

export const DEFAULT_CONSENT_TEMPLATES: DefaultConsentTemplate[] = [
  { name: 'Consentimiento informado general odontológico', bodyMarkdown: GENERAL_ODONTOLOGICO },
  { name: 'Exodoncia (extracción dental) simple y quirúrgica', bodyMarkdown: EXODONCIA },
  { name: 'Endodoncia (tratamiento de conductos)', bodyMarkdown: ENDODONCIA },
  { name: 'Implante dental', bodyMarkdown: IMPLANTE },
  { name: 'Blanqueamiento dental', bodyMarkdown: BLANQUEAMIENTO },
  { name: 'Ortodoncia', bodyMarkdown: ORTODONCIA },
  { name: 'Tratamiento de datos personales (Habeas Data)', bodyMarkdown: HABEAS_DATA },
  { name: 'Consulta médica general', bodyMarkdown: CONSULTA_MEDICA },
];
