# Arquitectura

## Capas

```
Pantallas (src/app)          solo presentación y navegación
Componentes (src/components) UI reutilizable y piezas de marca
Lógica (src/lib)             cliente Supabase, configuración, validaciones
Backend (supabase/)          Postgres + RLS + funciones SQL / Edge Functions
```

## Principio de seguridad

**El móvil nunca decide nada importante.** Quién gana un Drop, quién es fundador, qué challenge cuenta, cuánto cobra un creador: todo lo decide el servidor dentro de una transacción, y queda en `audit_log`.

- Cada tabla tiene Row Level Security activado.
- La app solo lleva la clave pública (anon/publishable). `src/lib/env.ts` se niega a usar una clave secreta.
- Los roles de staff están en `user_roles`; los clientes no pueden escribir en esa tabla. Se cambian con `grant_role` / `revoke_role`, que comprueban que eres admin y lo registran.
- `audit_log` es solo de añadir: un trigger bloquea `UPDATE`, `DELETE` y `TRUNCATE`.
- Borrar una cuenta borra el perfil en cascada (requisito de App Store).

## Esquema actual (Fase 1)

| Tabla | Para qué |
| --- | --- |
| `profiles` | Un perfil por usuario, creado al registrarse con un username provisional |
| `user_roles` | Roles de staff: `admin`, `moderator` |
| `audit_log` | Historial inmutable de acciones sensibles |

Las siguientes tablas se añaden en su fase, cada una con su migración y sus tests: challenges y submissions (3), posts y friendships (4), drops y claims (5), competitions y score_adjustments (6), meetups, conversations y messages (7), orders y founder_allocations (8), designs y commissions (9).

## Tests de base de datos

`npm run test:db` levanta un Postgres temporal, simula las piezas de Supabase que usan las migraciones (`supabase/tests/_auth_stub.sql`), aplica todas las migraciones y ejecuta `supabase/tests/*.test.sql` actuando como visitante anónimo, miembro, moderador y admin.
