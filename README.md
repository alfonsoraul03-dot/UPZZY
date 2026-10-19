# UPZZY

**happened by mistake. stayed on purpose.**

App móvil (iOS y Android) de UPZZY: un juego diario de encontrar el error (*daily oops*), un challenge de foto al día con feed tipo TikTok (global y amigos) y el drop actual de la marca.

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

La pestaña **today** funciona sin backend ni conexión. La pestaña **oops** (challenges, fotos, likes, amigos) necesita Supabase: mira la sección siguiente. Sin Supabase verás "the feed isn't connected yet.".

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
5. Para que el login funcione con un **código** (sin contraseñas ni enlaces), ve a **Authentication → Emails (Templates)** y en las plantillas **Confirm signup** y **Magic Link** añade esta línea al texto:
   ```
   tu código: {{ .Token }}
   ```
6. Reinicia Expo con `npx expo start --clear` para que lea el `.env`.
7. Para hacerte administrador, regístrate en la app y luego abre **SQL Editor** en Supabase y ejecuta:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'TU_EMAIL';
   ```

### Cambiar los challenges

Cada día hay un challenge (hora de Madrid). Si no programas ninguno, sale uno de la lista `challenge_prompts`, que puedes editar en **Table Editor**. Para programar uno concreto (por ejemplo con premio), en **SQL Editor**:

```sql
select public.schedule_challenge('2026-10-25', 'tu upzzy en la playa.', 'arena cuenta. mar cuenta.', 'una camiseta gratis');
```

(Funciona desde el SQL Editor porque ahí eres el dueño de la base de datos; desde la app solo pueden hacerlo admins y moderadores.)

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
  (tabs)/           today (daily oops), oops (challenge y feed), drop
  account.tsx       login con código, nombre, cerrar sesión, borrar cuenta
  capture.tsx       foto del challenge (solo cámara)
src/game/           lógica del juego (niveles, daily, rachas), con tests
src/social/         reglas del challenge y del feed, con tests
src/components/     tablero, logo y componentes de interfaz
src/theme/          colores, tipografía y espaciado (design tokens)
src/lib/            Supabase, configuración y validaciones
supabase/           migraciones SQL y tests de base de datos
assets/brand/       logo en SVG
```
