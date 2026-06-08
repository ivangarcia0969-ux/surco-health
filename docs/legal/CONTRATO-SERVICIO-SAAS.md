# CONTRATO DE PRESTACIÓN DE SERVICIOS DE SOFTWARE COMO SERVICIO (SaaS)

> ⚠️ **PLANTILLA — NO ES ASESORÍA LEGAL.** Este documento es un punto de partida
> sólido. **Antes de usarlo con tu primer cliente, hazlo revisar por un abogado**
> con conocimiento en protección de datos y derecho comercial colombiano. Reemplaza
> todo lo que está entre `[CORCHETES]`.

---

**Entre:**

**EL PRESTADOR:** `[NOMBRE COMPLETO]`, mayor de edad, identificado con cédula de
ciudadanía No. `[CC]`, con RUT No. `[NIT/RUT]`, domiciliado en `[CIUDAD]`, quien
para efectos de este contrato se denomina **"SURCO HEALTH"** o **"EL PRESTADOR"**.

**EL CLIENTE:** `[RAZÓN SOCIAL DE LA CLÍNICA]`, identificada con NIT No. `[NIT]`,
representada legalmente por `[NOMBRE REP. LEGAL]`, identificado con C.C. No. `[CC]`,
con domicilio en `[DIRECCIÓN]`, quien se denomina **"EL CLIENTE"** o
**"LA CLÍNICA"**.

Se celebra el presente contrato de prestación de servicios, regido por las
siguientes cláusulas:

---

## PRIMERA — OBJETO

EL PRESTADOR concede a EL CLIENTE una **licencia de uso no exclusiva e
intransferible** sobre la plataforma de software "Surco Health" (en adelante
"LA PLATAFORMA"), accesible vía web, que incluye: gestión de historia clínica
electrónica, agenda, pacientes, odontograma, notas clínicas, exportación FHIR y
demás funcionalidades según el plan contratado.

LA PLATAFORMA se presta bajo modalidad **SaaS (Software como Servicio)**: EL
CLIENTE no adquiere el software, sino el derecho a usarlo durante la vigencia del
contrato.

## SEGUNDA — PLAN CONTRATADO Y PRECIO

| Concepto | Detalle |
|---|---|
| Plan | `[FREE / PRO / CLÍNICA / ENTERPRISE]` |
| Precio | `[VALOR]` COP `[/profesional]` / mes |
| Periodicidad de pago | `[Mensual / Anual]` |
| Forma de pago | Wompi (PSE, tarjeta, Nequi) / transferencia a `[CUENTA]` |
| Día de corte | `[N]` de cada mes |

El precio podrá ser reajustado anualmente conforme al IPC, notificando con
**treinta (30) días** de anticipación.

## TERCERA — VIGENCIA Y RENOVACIÓN

El contrato tiene vigencia de `[1 mes / 1 año]` contado desde la activación,
**renovable automáticamente** por periodos iguales salvo aviso de no renovación
de cualquiera de las partes con **treinta (30) días** de anticipación.

## CUARTA — OBLIGACIONES DEL PRESTADOR

1. Mantener LA PLATAFORMA disponible con una meta de **99.5%** mensual (excluyendo
   mantenimientos programados notificados con antelación).
2. Aplicar medidas de seguridad razonables: cifrado en tránsito (HTTPS), cifrado
   at-rest de campos sensibles, registro de auditoría inmutable, copias de
   seguridad cifradas.
3. Conservar la historia clínica por el término legal de **quince (15) años**
   (Resolución 839 de 2017) mientras dure el contrato y durante el periodo de
   gracia posterior.
4. Entregar, a la terminación del contrato, una **exportación completa** de los
   datos de EL CLIENTE en formato estándar (FHIR R4 / CSV / PDF).
5. Notificar a EL CLIENTE cualquier incidente de seguridad que afecte sus datos
   dentro de las **cuarenta y ocho (48) horas** siguientes a su detección.

## QUINTA — OBLIGACIONES DEL CLIENTE

1. Pagar oportunamente el precio pactado.
2. **Obtener la autorización de tratamiento de datos (Habeas Data) de cada
   paciente** antes de registrarlo en LA PLATAFORMA. ESTA OBLIGACIÓN ES EXCLUSIVA
   DE EL CLIENTE.
3. **Registrar sus bases de datos ante el RNBD de la SIC** cuando la ley se lo
   exija. EL CLIENTE es el **Responsable** del tratamiento; EL PRESTADOR es
   únicamente **Encargado** (ver Anexo A).
4. Usar LA PLATAFORMA conforme a la ley y la lex artis médica. EL PRESTADOR no
   interviene ni es responsable de las decisiones clínicas, diagnósticos o
   prescripciones, que son de exclusiva responsabilidad del profesional de salud.
5. Custodiar las credenciales de acceso de sus usuarios.
6. No realizar ingeniería inversa, reventa ni cesión de la licencia.

## SEXTA — PROPIEDAD INTELECTUAL

LA PLATAFORMA, su código, diseño y marca son propiedad exclusiva de EL PRESTADOR.
Los **datos cargados por EL CLIENTE son y seguirán siendo propiedad de EL CLIENTE**.

## SÉPTIMA — TRATAMIENTO DE DATOS PERSONALES

Las partes suscriben el **Anexo A — Contrato de Transmisión/Encargo de Tratamiento
de Datos Personales**, que forma parte integral de este contrato y regula la
relación Responsable–Encargado conforme a la Ley 1581 de 2012 y el Decreto 1377
de 2013.

## OCTAVA — LIMITACIÓN DE RESPONSABILIDAD

En la máxima medida permitida por la ley:

1. EL PRESTADOR no será responsable por daños indirectos, lucro cesante, pérdida de
   oportunidad ni daños punitivos.
2. La responsabilidad total y acumulada de EL PRESTADOR queda **limitada al monto
   efectivamente pagado por EL CLIENTE en los doce (12) meses anteriores** al hecho
   que origina la reclamación.
3. EL PRESTADOR **no es responsable** por: (a) decisiones clínicas; (b) la falta de
   autorización Habeas Data que debía obtener EL CLIENTE; (c) el uso indebido de
   credenciales por parte de usuarios de EL CLIENTE; (d) caídas de servicios de
   terceros (hosting, internet, pasarela de pago, Meta/WhatsApp).

## NOVENA — CONFIDENCIALIDAD

Ambas partes guardarán reserva sobre la información confidencial de la otra,
obligación que sobrevive **dos (2) años** a la terminación del contrato.

## DÉCIMA — TERMINACIÓN

El contrato podrá terminarse:
1. Por mutuo acuerdo.
2. Por incumplimiento no subsanado dentro de **quince (15) días** del requerimiento.
3. Por falta de pago superior a **treinta (30) días**, suspendiendo el servicio.

A la terminación, EL PRESTADOR entregará la exportación de datos y, transcurrido el
periodo de gracia de **noventa (90) días**, procederá a la eliminación segura
conforme a los plazos legales de retención.

## DÉCIMA PRIMERA — LEY APLICABLE Y SOLUCIÓN DE CONTROVERSIAS

Este contrato se rige por las leyes de la República de Colombia. Las controversias
se resolverán mediante **arreglo directo** y, de no lograrse en treinta (30) días,
ante la **jurisdicción ordinaria** del domicilio de EL PRESTADOR.

---

**Firmas:**

| EL PRESTADOR | EL CLIENTE |
|---|---|
| _______________________ | _______________________ |
| `[NOMBRE]` | `[NOMBRE REP. LEGAL]` |
| C.C. `[CC]` | C.C. `[CC]` · NIT `[NIT]` |

Fecha: `[DD/MM/AAAA]` · Ciudad: `[CIUDAD]`
