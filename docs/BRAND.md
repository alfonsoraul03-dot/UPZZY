# UPZZY: marca en la app

**happened by mistake. stayed on purpose.**

UPZZY viene de "oopsie". Todo es tranquilo, limpio y mínimo, con UN error deliberado. El error es la firma.

## Reglas en la app

- **Oops Orange `#E4572E` solo marca el error:** la segunda Z del logo y los dibujos de la tienda. Nunca en botones, puntos ni navegación.
- **Un solo gesto por pantalla:** la Z que se cae (slip), el contorno movido (misregistration), la forma fuera de línea, la letra al revés (wrong side).
- **Texto:** minúsculas, corto y seco. "oops.", "posted. no undo.", "not out yet.", "be quick."
- **Estilo de la app:** oscura, como BeReal y TikTok, para que las fotos pongan el color. Home tipo TikTok (foto a pantalla completa, botones a la derecha), perfil y ranking tipo BeReal (tarjetas redondeadas), chats tipo Instagram (burbujas redondas).
- **Tipografía:** Archivo Black en mayúsculas solo para el logo. Plus Jakarta Sans para todo lo demás: negrita (700) solo en titulares, semibold (600) en botones y nombres, regular (400) para leer. Escala en `type` de `tokens.ts`: hero 36, heading 30, title 21, lead 17, body 16, caption 14, label 13.
- **Botones y campos:** misma altura (54), esquinas de 12, nunca píldoras. Principal: blanco cálido con texto casi negro. Secundario: relleno oscuro con borde fino. Desactivado: gris propio (#343434 / #898989), no una copia transparente. El campo activo enciende su borde.
- **Movimiento (`src/theme/motion.ts`, Reanimated):** rápido, callado, sin rebotes; las cosas se posan como una tela. Pulsar 110 ms, soltar 170 ms, cambios pequeños 180 ms, entradas 300 ms, hojas 300 ms. Una sola curva (`easeOut`). Todo sigue el ajuste "reducir movimiento" del móvil. Animado: entrada del logo, botones que se hunden al pulsar, corazón al dar like y corazón grande al doble toque, global/friends, iconos de las pestañas, fundido entre pestañas, menú de la foto que sube desde abajo, puntos de la galería y la bolsa. No animamos listas enteras al aparecer.
- **Pasos antes de la app (edad, fotos, código):** componente `Onboarding`: logo arriba, titular y explicación juntos, acciones abajo donde llega el pulgar.
- **Icono de la app:** fondo negro, círculo crema y aro Oops Orange desplazado (`assets/`). En la pantalla de inicio, la misma marca sobre negro.
- **Iconos:** de línea, del color del texto (`src/components/ui/Icon.tsx`). Avatares: círculo con la inicial mientras no haya foto de perfil.
- **Formas:** círculos, cuadrados, barras, puntos y letras sueltas. Sin ilustraciones ni texturas. El único degradado es la sombra negra sobre las fotos para que se lea el texto.
- **Mucho espacio vacío.**

## Colores

La app usa ahora siempre el tema oscuro. El claro se guarda en `tokens.ts` por si vuelve.

| Token | Oscuro (el que se usa) | Claro (guardado) |
| --- | --- | --- |
| Fondo | Negro profundo `#050505` | Chalk `#F2F0EA` |
| Tarjetas | `#141414` | `#FAF8F3` |
| Hilo principal (texto) | Blanco cálido `#F7F6F3` | Washed Black `#2E2C2A` |
| Texto secundario | `#A6A39F` | Stone Grey `#6B665E` |
| Bordes | `#292929` | Oatmeal `#D9CDB8` |
| Botón principal | `#F5F4F0` con texto `#101010` | Washed Black con texto Chalk |
| Oops | `#E4572E` | `#E4572E` |

El contraste de todos los pares lo comprueba `src/__tests__/contrast.test.ts`.

## Secreto

Mantén pulsado el logo: la Z se cae un poco más.
