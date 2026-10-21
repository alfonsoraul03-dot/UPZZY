# Plan

## Ahora: un challenge al día, tipo BeReal

Tres pestañas:

| Pestaña | Qué es |
| --- | --- |
| **home** | Las fotos del challenge de hoy, una por pantalla. Arriba **global** o **friends**. Cada foto lleva en pequeño las reacciones: selfies de la gente con la cámara frontal (doble toque o "react"). Mientras el challenge de hoy no ha salido se ven las fotos de ayer. |
| **ranking** | Puntos del mes, global y amigos. |
| **you** | Tu perfil: cuadrícula de tus fotos, racha de días seguidos y puntos. Ajustes y tienda. Tocando un nombre ves el perfil de otra persona y puedes seguirla. |

Reglas (todas en el servidor):
- El challenge sale cada día a una hora al azar entre las 9:00 y las 21:00 (Madrid), la misma para todos. Antes de esa hora nadie ve ni el título.
- Puntos: 100 si publicas en los 5 primeros minutos, 1 menos cada 5 minutos, mínimo 10.
- Racha: días seguidos con foto. Se mantiene hasta que acaba el día siguiente.
- Ranking: suma de puntos del mes (hora de Madrid). En amigos sales tú y la gente que sigues.

## Paso a paso

1. ✓ Fotos con la cámara, feed global y amigos, seguir, reportar, bloquear, borrar cuenta.
2. ✓ Challenge a hora al azar, puntos por rapidez, reacciones con selfie, perfil, racha, ranking.
3. ✓ Puntos nuevos: cada reto vale hasta 500 (al azar), +1 por like, +10 por amigo, y solo cuentan las fotos con una prenda UPZZY que revisa el staff. Retos pensados para llevar la ropa. Letra Plus Jakarta Sans.
4. ✓ Acceso solo con prenda: código de un solo uso en el paquete.
5. ✓ Mensajes entre amigos (os seguís los dos). En desarrollo la app entra sola, sin login.
6. **Notificación** cuando sale el challenge ("the oops is out. 2 min for 100 pts.").
7. **Email propio** (Resend) para que el login funcione para todo el mundo.
8. Premios: racha de 100 días y ganador del mes, revisados por una persona.
9. Comentarios, First 100, Drops con reservas, Creator Club.

## Base técnica que ya existe

- Expo SDK 57 + TypeScript + Expo Router.
- Supabase: perfiles, roles, registro de auditoría, challenges, fotos, reacciones, puntos, seguir, mensajes, reportes y bloqueos, con tests de seguridad (`npm run test:db`).
