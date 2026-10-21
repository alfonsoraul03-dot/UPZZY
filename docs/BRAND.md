# UPZZY: marca en la app

**happened by mistake. stayed on purpose.**

UPZZY viene de "oopsie". Todo es tranquilo, limpio y mínimo, con UN error deliberado. El error es la firma.

## Reglas en la app

- **Oops Orange `#E4572E` solo marca el error:** la segunda Z del logo y los dibujos de la tienda. Nunca en botones, puntos ni navegación.
- **Un solo gesto por pantalla:** la Z que se cae (slip), el contorno movido (misregistration), la forma fuera de línea, la letra al revés (wrong side).
- **Texto:** minúsculas, corto y seco. "oops.", "posted. no undo.", "not out yet.", "be quick."
- **Estilo de la app:** oscura, como BeReal y TikTok, para que las fotos pongan el color. Home tipo TikTok (foto a pantalla completa, botones a la derecha), perfil y ranking tipo BeReal (tarjetas redondeadas), chats tipo Instagram (burbujas redondas).
- **Tipografía:** Archivo Black en mayúsculas solo para el logo. Inter para todo lo demás, en negrita gruesa (800) para títulos y nombres.
- **Iconos:** de línea, del color del texto (`src/components/ui/Icon.tsx`). Avatares: círculo con la inicial mientras no haya foto de perfil.
- **Formas:** círculos, cuadrados, barras, puntos y letras sueltas. Sin ilustraciones ni texturas. El único degradado es la sombra negra sobre las fotos para que se lea el texto.
- **Mucho espacio vacío.**

## Colores

La app usa ahora siempre el tema oscuro. El claro se guarda en `tokens.ts` por si vuelve.

| Token | Oscuro (el que se usa) | Claro (guardado) |
| --- | --- | --- |
| Fondo | Negro `#000000` | Chalk `#F2F0EA` |
| Tarjetas | `#141414` | `#FAF8F3` |
| Hilo principal (texto, botones) | Blanco `#FFFFFF` | Washed Black `#2E2C2A` |
| Oops | `#E4572E` | `#E4572E` |

El contraste de todos los pares lo comprueba `src/__tests__/contrast.test.ts`.

## Secreto

Mantén pulsado el logo: la Z se cae un poco más.
