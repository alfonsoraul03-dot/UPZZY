# UPZZY

**happened by mistake. stayed on purpose.**

App móvil (iOS y Android) de UPZZY: un challenge de foto al día que sale a una hora al azar, con feed global y de amigos, reacciones con selfie, perfil con racha y puntos, y ranking del mes.

- Plan por fases: [docs/PLAN.md](docs/PLAN.md)
- Sistema visual de la marca: [docs/BRAND.md](docs/BRAND.md)
- Arquitectura y seguridad: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Tecnología

| Parte | Qué usamos | Por qué |
| --- | --- | --- |
| App | Expo (SDK 57) + React Native + TypeScript | Una sola base de código para iPhone y Android, y puedes probarla en tu móvil al instante con Expo Go. |
| Navegación | Expo Router | Cada archivo en `src/app/` es una pantalla. |
| Backend | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) | Base de datos real con seguridad por filas (RLS), login, fotos y chat en tiempo real. |
| Builds | EAS Build | Genera las apps para App Store y Google Play en la nube, sin Xcode. |

## Probar la app en tu Mac y en tu móvil

Necesitas [Node.js](https://nodejs.org) 20 o superior (compruébalo con `node -v`).

1. Descarga el código:
   ```bash
   git clone https://github.com/alfonsoraul03-dot/upzzy.git
   cd upzzy
   npm install
   ```
2. Arranca el servidor de desarrollo:
   ```bash
   npx expo start
   ```
3. En tu iPhone o Android instala **Expo Go** desde la App Store o Google Play.
4. Escanea el código QR que aparece en la terminal (con la cámara en iPhone, o desde Expo Go en Android). El móvil y el Mac tienen que estar en la misma red wifi.
   - Si no conecta, para el servidor con `Ctrl+C` y prueba `npx expo start --tunnel`.
5. Para verla en el navegador del Mac pulsa `w` en la terminal.

La app necesita Supabase: mira la sección siguiente. Sin Supabase verás "not connected yet.".

## Conectar Supabase (para los challenges y el feed)

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo llamado `upzzy`. Elige la región más cercana a tus usuarios (por ejemplo, West EU). Guarda la contraseña de la base de datos en un lugar seguro.
2. En el panel del proyecto ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon / publishable key** (nunca la `service_role` o `secret`).
3. En la carpeta del proyecto:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y pega los dos valores.
4. Aplica el esquema de base de datos (crea las tablas, la seguridad y la carpeta de fotos):
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF   # el ref es la parte de la URL antes de .supabase.co
   npx supabase db push
   ```
5. Para que el enlace del email abra la app, ve a **Authentication → URL Configuration → Redirect URLs** y añade estas dos (botón **Add URL**):
   ```
   exp://**
   upzzy://**
   ```
   La primera es para probar con Expo Go; la segunda, para la app publicada. Abre el email **en el móvil** y toca el enlace: se abre la app y ya estás dentro.
6. Mientras desarrollas puedes entrar sin email: en **Authentication → Sign In / Providers** activa **Allow anonymous sign-ins**. Con eso, en desarrollo la app entra sola con una cuenta de prueba, sin pantalla de login. En la app publicada esto no pasa.
7. Reinicia Expo con `npx expo start --clear` para que lea el `.env`.
8. Para hacerte administrador, regístrate en la app y luego abre **SQL Editor** en Supabase y ejecuta:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'TU_EMAIL';
   ```

### Cambiar los challenges

Cada día hay un challenge (hora de Madrid) que sale a una hora al azar entre las 9:00 y las 21:00. Si no programas ninguno, sale uno de la lista `challenge_prompts`, que puedes editar en **Table Editor**. Para programar uno concreto (por ejemplo con premio), en **SQL Editor**:

```sql
select public.schedule_challenge('2026-10-25', 'tu upzzy en la playa.', 'arena cuenta. mar cuenta.', 'una camiseta gratis');
-- con hora fija en vez de al azar:
select public.schedule_challenge('2026-10-26', 'sunrise. no filter.', null, null, '2026-10-26 08:30+02');
```

(Funciona desde el SQL Editor porque ahí eres el dueño de la base de datos; desde la app solo pueden hacerlo admins y moderadores.)

### Códigos de acceso (van en el paquete)

Solo entra en la app quien ha comprado una prenda: cada paquete lleva un código de un solo uso. Para crear códigos, en **SQL Editor**:

```sql
select * from public.create_codes(100, 'drop 001');
```

Te devuelve 100 códigos tipo `UPZ-7K3MQ-9TX4P` que puedes descargar en CSV (botón de exportar del resultado) e imprimir en las tarjetas. Cada código sirve una sola vez. Para ver cuáles se han usado: **Table Editor → garment_codes** (`redeemed_at`). El staff entra sin código. Las cuentas que ya existían antes de este cambio siguen dentro.

### Revisar las fotos (prenda UPZZY)

Las fotos solo suman puntos cuando alguien del staff confirma que sale una prenda UPZZY. Para ser staff, en **SQL Editor** (cambia `TU_NOMBRE` por tu nombre en la app):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where username = 'TU_NOMBRE';
```

Luego en la app: **you → settings → check photos for upzzy**.

### Moderación

Tres reportes ocultan una foto automáticamente. Para ver o restaurar fotos, en **Table Editor → posts** (columna `status`), o con `select public.moderate_post('ID', 'visible');`. Todo queda en `audit_log`.

## Comprobaciones

```bash
npm run typecheck   # TypeScript
npm test            # tests de la app (Jest)
npm run test:db     # aplica las migraciones a un Postgres temporal y prueba la seguridad (necesita PostgreSQL instalado)
```

## Estructura

```
src/app/            pantallas (Expo Router)
  (tabs)/           home (feed), ranking, chats, you (perfil)
  account.tsx       login, nombre, cerrar sesión, borrar cuenta
  capture.tsx       foto del challenge (solo cámara)
  react.tsx         reacción con selfie
  user/[id].tsx     perfil de otra persona
  chat/[id].tsx     conversación con un amigo
  drop.tsx          tienda (drop 001)
  review.tsx        revisar fotos (solo staff)
  unlock.tsx        meter el código del paquete
src/social/         reglas del challenge y del feed, con tests
src/components/     tablero, logo y componentes de interfaz
src/theme/          colores, tipografía y espaciado (design tokens)
src/lib/            Supabase, configuración y validaciones
supabase/           migraciones SQL y tests de base de datos
assets/brand/       logo en SVG
```
