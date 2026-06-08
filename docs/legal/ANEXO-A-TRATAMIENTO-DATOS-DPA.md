# ANEXO A — CONTRATO DE ENCARGO DE TRATAMIENTO DE DATOS PERSONALES (DPA)

> ⚠️ **PLANTILLA — NO ES ASESORÍA LEGAL.** Revísala con un abogado antes de usarla.
> Este es el documento MÁS IMPORTANTE para protegerte: deja por escrito que EL
> CLIENTE (la clínica) es el **RESPONSABLE** de los datos de los pacientes y tú
> eres solo el **ENCARGADO** que los procesa siguiendo sus instrucciones. Esto
> traslada la responsabilidad principal de Habeas Data a la clínica.

Anexo integral al Contrato de Prestación de Servicios SaaS suscrito entre las
mismas partes. Regido por la **Ley 1581 de 2012**, el **Decreto 1377 de 2013** y
demás normas concordantes.

---

## 1. ROLES DE LAS PARTES

| Rol | Parte | Definición |
|---|---|---|
| **RESPONSABLE** | EL CLIENTE (la clínica) | Decide sobre la base de datos y la finalidad del tratamiento. Obtiene la autorización del titular. |
| **ENCARGADO** | EL PRESTADOR (Surco Health) | Trata los datos **por cuenta del Responsable**, siguiendo sus instrucciones. No decide sobre las finalidades. |

> Esta calificación es esencial: como **Encargado**, EL PRESTADOR no determina por
> qué ni para qué se recogen los datos del paciente; solo provee la herramienta y
> procesa según las instrucciones del Responsable.

## 2. OBJETO DEL TRATAMIENTO

EL ENCARGADO tratará, por cuenta del RESPONSABLE, los datos personales de los
pacientes y usuarios que el RESPONSABLE cargue en LA PLATAFORMA, con la única
finalidad de **prestar el servicio de software contratado** (almacenamiento,
gestión de HCE, agenda, etc.).

## 3. TIPOS DE DATOS Y TITULARES

- **Titulares:** pacientes y personal del RESPONSABLE.
- **Datos comunes:** nombre, documento, contacto, datos administrativos.
- **Datos sensibles (Art. 5 Ley 1581):** datos de salud, historia clínica,
  diagnósticos, notas psicológicas. Su tratamiento exige autorización **previa,
  expresa e informada** del titular, que **obtiene el RESPONSABLE**.

## 4. INSTRUCCIONES DEL RESPONSABLE

EL ENCARGADO tratará los datos **únicamente** conforme a las instrucciones
documentadas del RESPONSABLE y no los usará para fines propios. Las funcionalidades
de LA PLATAFORMA contratadas constituyen las instrucciones generales del
RESPONSABLE.

## 5. OBLIGACIONES DEL ENCARGADO (Art. 18 Ley 1581)

1. Tratar los datos solo para la finalidad pactada.
2. Aplicar medidas técnicas y administrativas de seguridad: cifrado en tránsito,
   cifrado at-rest de datos sensibles, control de acceso por rol, registro de
   auditoría inmutable de accesos a la HCE, copias de seguridad cifradas.
3. Garantizar la **confidencialidad**, incluso tras terminar el contrato.
4. Abstenerse de circular o ceder los datos a terceros, salvo subencargados
   autorizados (cláusula 7).
5. Apoyar al RESPONSABLE en la atención de **consultas y reclamos** de los titulares
   (derechos ARCO) mediante las funcionalidades de la plataforma (exportación,
   rectificación vía adenda, etc.).
6. **Notificar al RESPONSABLE** cualquier incidente de seguridad dentro de las
   **48 horas** siguientes a su detección.
7. Devolver o suprimir los datos a la terminación del contrato, según instruya el
   RESPONSABLE y respetando los plazos legales de retención (HCE: 15 años).

## 6. OBLIGACIONES DEL RESPONSABLE

1. **Obtener y conservar la autorización Habeas Data** de cada titular.
2. **Registrar sus bases de datos ante el RNBD de la SIC** cuando aplique.
3. Garantizar la veracidad y actualización de los datos que carga.
4. Atender en primera instancia los derechos ARCO de los titulares.
5. Adoptar su propia **política de tratamiento de datos** y publicarla.
6. Instruir el tratamiento únicamente para finalidades lícitas.

## 7. SUBENCARGADOS

El RESPONSABLE autoriza al ENCARGADO a apoyarse en los siguientes subencargados,
bajo contrato con obligaciones equivalentes de protección:

| Subencargado | Finalidad | Ubicación |
|---|---|---|
| `[Proveedor de hosting/VPS — ej. Hostinger]` | Infraestructura de servidores | `[país del datacenter]` |
| Meta Platforms (WhatsApp Cloud API) | Envío de recordatorios (si se activa) | EE.UU. |
| `[Pasarela de pago — Wompi]` | Procesamiento de pagos del CLIENTE (no de pacientes) | Colombia |

EL ENCARGADO notificará cambios de subencargados con **quince (15) días** de
antelación.

## 8. TRANSFERENCIAS INTERNACIONALES

Si algún subencargado está fuera de Colombia, el ENCARGADO garantiza que cumple
niveles adecuados de protección o que media cláusula contractual de protección,
conforme al Título VIII de la Ley 1581.

## 9. SEGURIDAD E INCIDENTES

EL ENCARGADO mantiene un registro de medidas de seguridad y un procedimiento de
respuesta a incidentes. En caso de violación de datos que represente riesgo, lo
reportará al RESPONSABLE para que este, a su vez, notifique a la SIC y a los
titulares cuando la ley lo exija.

## 10. RESPONSABILIDAD

Cada parte responde por el incumplimiento de **sus propias** obligaciones. En
particular, el ENCARGADO **no responde** por la ausencia de autorización Habeas
Data ni por el incumplimiento del registro RNBD, que son obligaciones del
RESPONSABLE.

## 11. VIGENCIA

Este Anexo rige durante toda la vigencia del Contrato principal y, en lo relativo a
confidencialidad y devolución/supresión, le sobrevive hasta el cumplimiento de los
plazos legales de retención.

---

**Firmas (idénticas al contrato principal):**

| EL ENCARGADO (Prestador) | EL RESPONSABLE (Cliente) |
|---|---|
| _______________________ | _______________________ |
| `[NOMBRE]` · C.C. `[CC]` | `[REP. LEGAL]` · NIT `[NIT]` |

Fecha: `[DD/MM/AAAA]`
