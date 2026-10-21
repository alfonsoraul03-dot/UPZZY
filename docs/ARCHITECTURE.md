# Arquitectura

## Capas

```
Pantallas (src/app)          solo presentación y navegación
Componentes (src/components) UI reutilizable y piezas de marca
Reglas (src/social)          lógica pura con tests (puntos, rutas de fotos, textos)
Lógica (src/lib)             cliente Supabase, llamadas al backend, configuración
Backend (supabase/)          Postgres + RLS + funciones SQL / Edge Functions
```

## Principio de seguridad

**El móvil nunca decide nada importante.** Quién gana un Drop, quién es fundador, qué challenge cuenta, cuánto cobra un creador: todo lo decide el servidor dentro de una transacción, y queda en `audit_log`.

- Cada tabla tiene Row Level Security activado.
- La app solo lleva la clave pública (anon/publishable). `src/lib/env.ts` se niega a usar una clave secreta.
- Los roles de staff están en `user_roles`; los clientes no pueden escribir en esa tabla. Se cambian con `grant_role` / `revoke_role`, que comprueban que eres admin y lo registran.
- `audit_log` es solo de añadir: un trigger bloquea `UPDATE`, `DELETE` y `TRUNCATE`.
- Borrar una cuenta borra el perfil en cascada (requisito de App Store).

## Esquema actual

| Tabla | Para qué |
| --- | --- |
| `profiles` | Un perfil por usuario, creado al registrarse con un username provisional |
| `user_roles` | Roles de staff: `admin`, `moderator` |
| `audit_log` | Historial inmutable de acciones sensibles |
| `challenges` | Un challenge por día (hora de Madrid), con hora de salida al azar (`opens_at`) y premio opcional |
| `challenge_prompts` | Lista de challenges para los días que nadie programó |
| `posts` | La foto de cada persona en el challenge del día (máximo una), con los puntos que calculó el servidor |
| `post_reactions` | Reacciones con selfie (una por persona y foto) |
| `post_likes` | Likes (de momento sin uso en la app) |
| `follows` | A quién sigues; el feed "friends" sale de aquí |
| `post_reports` | Reportes; con 3 la foto se oculta sola y se registra |
| `user_blocks` | Personas bloqueadas; sus fotos desaparecen de tu feed y no os podéis escribir |
| `messages` | Mensajes privados entre amigos; solo los leen las dos personas y solo se escriben con `send_message` |

Fotos: bucket privado `oops` (máx. 5 MB, solo JPEG). Cada usuario solo sube a su carpeta, y una foto solo se puede ver si su post es visible. El feed pide enlaces temporales (1 hora).

Reglas que comprueba el servidor (`submit_post`): que el challenge sea el de hoy y ya haya salido, que la foto esté subida en tu carpeta y que no hayas publicado ya hoy. La app solo abre la cámara (nunca la galería), pero el servidor no puede demostrar que una foto es nueva ni que lleva ropa UPZZY: cualquier premio necesita revisión humana.

Mensajes (`send_message`): solo entre amigos (os seguís los dos), nunca si uno ha bloqueado al otro, de 1 a 1000 caracteres y como mucho 30 por minuto. `my_chats` da la lista de conversaciones con los no leídos y `mark_read` los marca. Los mensajes nuevos llegan con Supabase Realtime; si falla, la conversación se refresca cada 10 segundos.

Entrar sin email: en desarrollo (`__DEV__`) `useSession` entra solo con una cuenta anónima de Supabase si no hay sesión, y el login tiene "skip email (dev only)". Nada de esto existe en la app publicada.

Puntos (`scores_since`, interno): cada reto vale al azar entre 100 y 500 (`max_points`) y te llevas más cuanto antes publiques (`post_points`). Las fotos empiezan en `review = 'pending'`: el staff las revisa con `review_post` (queda en `audit_log`) y solo las aprobadas suman sus puntos y sus likes (+1 cada uno, nunca de tu propia foto). Cada amigo (os seguís los dos) suma 10. `user_stats` y `monthly_ranking` solo devuelven totales.

Acceso (`20261023000000_access.sql`): solo entran los `members` (canjearon un código de `garment_codes` con `redeem_code`, un uso por código, máx. 10 intentos fallidos por hora, auditado) y el staff. Sin acceso no se leen fotos, perfiles ni ranking (RLS) y un trigger impide publicar, reaccionar, dar like, seguir o escribir. El staff crea códigos con `create_codes`. Desde el SQL Editor (dueño de la base, sin `set role`) `has_role` cuenta como staff.

Lecturas: `today_challenge` (oculta el título hasta la hora), `latest_challenge`, `challenge_feed`, `user_stats` (racha y puntos) y `monthly_ranking`.

Las siguientes tablas se añaden en su paso: racha de 100 días con premio validada en el servidor, comentarios, competición mensual, First 100, drops con reservas, Creator Club.

## Tests de base de datos

`npm run test:db` levanta un Postgres temporal, simula las piezas de Supabase que usan las migraciones (`supabase/tests/_auth_stub.sql`), aplica todas las migraciones y ejecuta `supabase/tests/*.test.sql` actuando como visitante anónimo, miembro, moderador y admin.

## Push del reto

- El móvil guarda su token de Expo con `save_push_token` (solo el suyo; máximo 5 móviles por cuenta). Al cerrar sesión se borra con `remove_push_token`.
- `send_drop_push()` corre cada minuto con pg_cron. Llama a `claim_drop_push()`, que marca el reto de hoy como avisado una sola vez (solo si abrió hace menos de 2 horas) y devuelve los móviles de los miembros con acceso. Después manda el push a Expo con pg_net, de 100 en 100. Queda en `audit_log` como `challenge.push`.
- La app no puede lanzar el push. Solo lo hace el programador de tareas de la base de datos.
- En la app: `src/lib/push.ts`. Hace falta un development build (Expo Go no recibe push) y el `projectId` de EAS en `app.json`, que se pone con `eas init`.
