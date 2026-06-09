# 🎨 Guía de marca — Surco Health

## Nombre
**Surco Health**. Wordmark: **Surco** en gris oscuro + **Health** en teal.

## Logo
- **Isotipo:** cruz médica blanca sobre badge teal con degradado (`/icon.svg`).
- **Componente:** `@/components/brand/Logo` → `<Logo />` y `<LogoMark />`.
- Archivos: `public/favicon.svg`, `public/icon.svg` (PWA 512), `public/og.svg` (1200×630 redes).

## Colores
| Uso | Color | Hex |
|---|---|---|
| Marca / acento | **Teal** | `#0d9488` (claro `#14b8a6`, menta `#cdfaf2`) |
| Fondo claro | Menta | `#f0fdfa` |
| Superficie | Blanco | `#ffffff` |
| Texto | Slate | `#0f172a` / `#475569` |

> Nota: el color `brand` de Tailwind está remapeado a teal, así que todo el
> interior de la app usa esta paleta automáticamente.

## Tipografía
- Inter / system-ui (limpia, legible, clínica). Sin display llamativo:
  en salud prima la claridad y la confianza.

## Tono de voz
Calmado, profesional, confiable. Enfatiza **seguridad y cumplimiento**
(Habeas Data, cifrado, FHIR). "La historia clínica de tu consultorio, simple y segura".

## Uso del logo
- Fondo claro (default). Mantener la cruz blanca dentro del badge teal.
- No usar el dorado de Fígaro aquí — son marcas distintas.
