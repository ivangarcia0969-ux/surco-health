# 🦷 Guía de demo — Surco Health para consultorios odontológicos

> Preparada el 23-24 de septiembre de 2026 para la demo comercial con un consultorio odontológico.

## 1. Datos de acceso (clínica demo "Clínica Dental Sonrisa")

Web: **https://app.salud.surcoapp.tech/login**
Contraseña de todos los usuarios: **`Sonrisa2026*`**

| Rol | Correo | Qué muestra mejor |
|---|---|---|
| Odontóloga | `dra.valencia@sonrisa.demo` | Agenda del día, botón **Atender**, odontograma, plan, recetas, consentimientos |
| Odontólogo | `dr.rios@sonrisa.demo` | Segundo profesional (agenda separada) |
| Administradora (dueña) | `admin@sonrisa.demo` | Ingresos del día y del mes, gráfica, caja, precios, plantillas, ajustes |
| Recepción | `recepcion@sonrisa.demo` | Agendar, "Llegó", recordatorio por WhatsApp, cobrar abonos |

> La contraseña se puede cambiar al cargar los datos con la variable `DEMO_PASSWORD`.

## 2. Guion sugerido (12 minutos)

1. **Inicio (dueña)** — entrar como `admin@sonrisa.demo`. Mostrar el saludo, las citas del día,
   **recaudado hoy / este mes**, tratamientos por cobrar y la **gráfica del mes**.
2. **Agenda** — citas de hoy de los dos odontólogos, estados con colores (en espera, confirmada…).
   Botón **"Recordar por WhatsApp"**: abre WhatsApp con el mensaje listo para el paciente.
3. **Atender una cita (odontóloga)** — entrar como `dra.valencia@sonrisa.demo` → Inicio → **Atender**
   en *María Fernanda Ospina* (8:00 a. m.). Aparece la barra verde "Atendiendo cita".
4. **Odontograma** — tocar superficies con la paleta de colores (caries, resina, endodoncia…). Guardar.
5. **Plan y presupuesto** — "+ Agregar procedimientos": tocar el diente en el esquema, elegir el
   servicio (el precio sale solo del catálogo), marcar superficies. El odontograma se actualiza solo.
   Luego **"📄 Presupuesto / PDF"**: documento con logo, datos de la clínica, valores, condiciones y
   firmas. Botón **"Enviar por WhatsApp"**.
6. **Pagos** — "💵 Registrar abono" (efectivo, tarjeta, Nequi/transferencia) → se genera el
   **recibo de caja** imprimible (con el valor en letras) y el saldo se actualiza.
7. **Recetas** — "+ Nueva receta" con atajos odontológicos (amoxicilina, ibuprofeno, clorhexidina…).
   La paciente es **alérgica a la penicilina**: la app lo advierte en rojo. Imprimir con firma del
   profesional (la firma se dibuja una vez en **Mi perfil y firma**).
8. **Consentimientos** — "+ Nuevo consentimiento" → elegir *Exodoncia* → escribir "Exodoncia del 38"
   → el paciente lee en la tablet/celular → marca "He leído" → **firma con el dedo** → queda guardado
   con fecha, hora, IP y huella SHA-256 (Ley 527 de 1999). Imprimir o guardar en PDF.
9. **Radiografías** — "🩻 Radiografías" → subir una foto o "📷 Tomar foto" desde el celular. Abrir el
   visor: **zoom, brillo, contraste y negativo** (muy útil para periapicales y panorámicas).
10. **Finalizar atención** — botón blanco en la barra verde. La cita queda "Atendida".
11. **Caja (dueña o recepción)** — recibos del día, total por medio de pago.
12. **Celular** — abrir la misma dirección en el teléfono: menú inferior, todo funciona igual.

### Frases de venta útiles
- "Todo queda en la nube, con copia de seguridad y cumpliendo Habeas Data y la Resolución 1995."
- "El consentimiento se firma en la tablet, sin papel, y tiene validez legal (Ley 527)."
- "El presupuesto y el recibo salen con su logo y se envían por WhatsApp en un clic."
- "Prueba gratis de 14 días. Plan Pro $89.000/mes · Clínica $189.000/mes."

## 3. Refrescar la agenda la mañana de la demo

La agenda demo se genera para **hoy y mañana** según la fecha en que se cargan los datos. Si se
cargó un día antes, correr de nuevo el script la mañana de la demo (no duplica pacientes ni pagos;
solo regenera las citas de hoy/mañana que no se hayan atendido):

```bash
cd /opt/surco-health
docker compose -f infra/docker-compose.prod.yml --env-file .env run --rm --entrypoint sh api -c "cd /repo && pnpm --filter @surco/db db:seed:demo"
```

## 4. Publicar la versión nueva en el servidor

```bash
ssh root@2.24.89.123
cd /opt/surco-health
bash infra/scripts/deploy.sh 2>&1 | tee /tmp/surco-deploy.log
docker compose -f infra/docker-compose.prod.yml --env-file .env run --rm --entrypoint sh api -c "cd /repo && pnpm --filter @surco/db db:seed:demo"
```

Después de publicar: abrir la web con **Ctrl + Shift + R** (o en ventana de incógnito) para no ver
la versión vieja guardada en el navegador.

## 5. Qué se agregó en esta versión

| Módulo | Qué hace |
|---|---|
| Atender desde la agenda | Botón **Atender** en agenda e inicio; barra "Atendiendo cita" con consulta, procedimientos y finalizar |
| Plan de tratamiento | Formulario por diente con esquema FDI, superficies, servicio del catálogo y precio; actualiza el odontograma |
| Presupuesto imprimible | PDF con logo, datos de la clínica, valores, abonos, condiciones y firmas; envío por WhatsApp |
| Pagos / abonos | Recibo de caja numerado (RC-000001…), saldo del paciente, valor en letras, envío por WhatsApp |
| Caja | Recibos del día, total por medio de pago, recaudo del mes, tratamientos por cobrar |
| Recetas | Fórmula con atajos odontológicos, alerta de alergias, firma del profesional, impresión y WhatsApp |
| Consentimientos | 8 plantillas (general, exodoncia, endodoncia, implante, blanqueamiento, ortodoncia, Habeas Data, medicina general), firma con el dedo, huella SHA-256, constancia Ley 527 |
| Radiografías y archivos | Subida (arrastrar, cámara del celular), visor con zoom/brillo/contraste/negativo, PDF |
| Inicio renovado | Saludo, KPIs de dinero, gráfica del mes, accesos rápidos |
| Menú | Arreglado el enlace roto del odontólogo; menú inferior en celular; "Mi perfil y firma" |
| Correcciones | Recargar la página ya no saca al login; colores de marca que no se veían; logo en celular |
