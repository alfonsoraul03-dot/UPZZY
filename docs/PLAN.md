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
3. ✓ Puntos nuevos: cada reto vale hasta 500 (al azar), +1 por like, +10 por amigo, y solo cuentan las fotos con una prenda UPZZY que revisa el staff. Si el staff pulsa "no upzzy", la foto se borra del todo (también el archivo, sin vuelta atrás), ese día ya no se puede volver a publicar, y en home sale "UPZZZZ. you made a mistake… try again tomorrow". Las fotos no salen en global ni friends (ni se pueden dar likes o reacciones) hasta que el staff las aprueba; quien la sube la ve al momento con "upzzy check pending". Retos pensados para llevar la ropa. Letra Plus Jakarta Sans.
4. ✓ Acceso solo con prenda: código de un solo uso en el paquete. Al meterlo sale la bienvenida con las reglas de puntos y el premio: el top 3 global de cada mes gana una prenda gratis (lo revisa el staff).
5. ✓ Mensajes entre amigos (os seguís los dos).
6. ✓ Notificación al móvil cuando sale el challenge: la base de datos la manda una vez por reto, cada minuto mira si ya salió (pg_cron + pg_net). El botón "ping me when it drops" aparece mientras esperas. Necesita development build y `eas init`.
7. ✓ Login con Apple y Google (elegido por Raul). En iPhone, Apple usa la hoja nativa; Google y Apple en Android abren el navegador seguro y vuelven a `upzzy://auth`. El email queda como opción secundaria. La app abre en la pantalla de entrar (UPZZY en grande) y después pide el código del paquete; en desarrollo ya no entra sola, queda el botón "skip (dev only)". Falta que Raul cree las claves en Apple y Google y las ponga en Supabase.
8. ✓ Seguridad para las tiendas: privacidad y términos en la app (`/legal/privacy`, `/legal/terms`), aviso al entrar, cola de denuncias para el staff (mantener, quitar o banear) y baneos que ningún código nuevo deshace.
9. Premios: racha de 100 días y ganador del mes, revisados por una persona.
10. Comentarios, First 100, Drops con reservas, Creator Club.

## Base técnica que ya existe

- Expo SDK 58 + TypeScript + Expo Router.
- Supabase: perfiles, roles, registro de auditoría, challenges, fotos, reacciones, puntos, seguir, mensajes, reportes y bloqueos, con tests de seguridad (`npm run test:db`).
