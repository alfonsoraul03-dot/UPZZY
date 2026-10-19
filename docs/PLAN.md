# Plan

## Ahora: sencilla y que enganche

Tres pestañas:

| Pestaña | Qué es |
| --- | --- |
| **today** | *Daily oops*: 10 cuadrículas, el mismo reto para todo el mundo, un intento al día. Racha de días y resultado para compartir. No hay modo infinito: se juega una vez al día. |
| **oops** | El challenge de foto del día. Feed a pantalla completa tipo TikTok: deslizas para ver la siguiente, doble toque para like. Arriba **global** y **friends** (la gente que sigues). Foto solo con la cámara, una al día. Reportar, bloquear y compartir tu foto. |
| **drop** | Drop 001 con enlace a la tienda de upzzyworld.com. |

## Paso a paso

1. ✓ **Challenges y feed**: login con código por email, foto diaria con la cámara, feed global y de amigos, likes, seguir, reportar, bloquear, borrar cuenta.
2. **Racha de 100 días con premio**: la racha del daily guardada y validada en el servidor; a los 100 días, un código para una prenda gratis.
3. **Comentarios y perfiles**: abrir el perfil de alguien y ver sus fotos.
4. **Competición mensual**: gana quien complete más challenges válidos del mes.
5. **First 100**, **Drops con reservas** y **Creator Club**.
6. Notificaciones: "the daily oops is out."

## Base técnica que ya existe

- Expo SDK 57 + TypeScript + Expo Router.
- Supabase: perfiles, roles, registro de auditoría, challenges, fotos, likes, seguir, reportes y bloqueos, con tests de seguridad (`npm run test:db`).
