# Lanzar upzzy

Lo que ya está en la app: builds de EAS (`eas.json`), aviso al móvil cuando sale el reto, login con Apple y Google, privacidad y términos, denuncias y baneos para el staff, e icono y pantalla de inicio oscuros.

Esto es lo que solo puedes hacer tú, en orden. Cada paso dice dónde se hace.

## 1. Poner tu Mac al día

```bash
cd ~/upzzy
git pull
npm install
npx supabase db push
```

`db push` sube los cambios nuevos a la base de datos: mensajes, puntos, códigos, avisos y denuncias.

## 2. Hacerte staff

En Supabase, abre **SQL Editor**. Pega esto con tu email y pulsa Run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'TU_EMAIL';
```

## 3. Cuentas (pagas tú)

- **Expo**: gratis, en expo.dev.
- **Apple Developer**: 99 $ al año, en developer.apple.com/programs.
- **Google Play Console**: 25 $ una vez, en play.google.com/console.

## 4. Conectar la app con EAS

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

`init` escribe el `projectId` en `app.json`. Sin él, los avisos al móvil no funcionan. Haz commit de ese cambio.

## 5. Login con Apple

1. En developer.apple.com → Certificates, IDs & Profiles → Identifiers, abre `com.upzzy.app` y activa **Sign In with Apple**.
2. Crea un **Services ID**, por ejemplo `com.upzzy.app.web`. Activa Sign In with Apple y pon como Return URL `https://invplnoxmxoqndfyblej.supabase.co/auth/v1/callback`.
3. En Keys, crea una key con Sign In with Apple y descarga el `.p8`.
4. En Supabase → Authentication → Sign In / Providers → **Apple**, actívalo. Pon en Client IDs `com.upzzy.app,com.upzzy.app.web`, y después tu Team ID, el Key ID y el contenido del `.p8`.
5. Sube la función que corta el acceso de Apple al borrar una cuenta (Apple lo exige). Usa la misma key:

```bash
npx supabase secrets set APPLE_TEAM_ID=TU_TEAM_ID APPLE_KEY_ID=TU_KEY_ID APPLE_CLIENT_ID=com.upzzy.app
npx supabase secrets set APPLE_PRIVATE_KEY="$(cat ~/Downloads/AuthKey_TU_KEY_ID.p8)"
npx supabase functions deploy apple-revoke
```

## 6. Login con Google

1. En console.cloud.google.com, crea un proyecto y configura la **OAuth consent screen** como External, con nombre upzzy.
2. En Credentials → Create credentials → OAuth client ID, elige el tipo **Web application**. Pon como redirect URI `https://invplnoxmxoqndfyblej.supabase.co/auth/v1/callback`.
3. En Supabase → Providers → **Google**, actívalo y pega el Client ID y el Secret.
4. Mientras pruebas, añade tu email en Google Auth Platform → Audience → **Test users**. El día del lanzamiento pulsa **Publish app** ahí mismo; si no, solo podrán entrar los usuarios de prueba.

## 7. URLs en Supabase

En Authentication → URL Configuration → Redirect URLs, añade `upzzy://auth`.

## 8. Probar en tu iPhone (development build)

```bash
npx eas-cli@latest device:create
npx eas-cli@latest build --profile development --platform ios
```

Instálala desde el enlace que te da EAS y abre `npx expo start` (sin `--go`: así el QR es para la app instalada). Prueba esto:

- entrar con Apple y con Google;
- meter un código;
- pulsar "ping me when it drops" y esperar al reto;
- hacer una foto, dar un like y mandar un mensaje.

## 9. Avisos en Android

1. Crea un proyecto en console.firebase.google.com y añade una app Android con el paquete `com.upzzy.app`.
2. Descarga `google-services.json` a la carpeta del proyecto. Añade `"googleServicesFile": "./google-services.json"` dentro de `android` en `app.json`.
3. En Firebase → Project settings → Service accounts, genera una clave. Súbela en expo.dev → tu proyecto → Credentials → Android → **FCM V1**.

En iPhone no hace falta nada: EAS crea la clave de avisos al hacer el build.

## 10. Comprobar los avisos del reto

En el SQL Editor:

```sql
select jobname, schedule from cron.job;
```

Tiene que salir `upzzy-drop-push` con `* * * * *`. Si no sale, activa **pg_cron** y **pg_net** en Database → Extensions y vuelve a hacer `npx supabase db push`.

## 11. Textos legales en la web

En Shopify → Online Store → Pages, crea dos páginas: **privacy** y **terms**. Pega el HTML de `privacy.html` y `terms.html` con el botón `<>` del editor. Quedan en `upzzyworld.com/pages/privacy` y `/pages/terms`; esas son las URLs que piden las tiendas.

## 12. Código para los revisores

En el SQL Editor:

```sql
select * from public.create_codes(2, 'app review');
```

En App Store Connect → App Review Information y en Google Play → App access, escribe: "Sign in with Apple or Google, then type this code: UPZ-…".

## 13. Subir a las tiendas

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```

En la ficha de cada tienda:

- **Capturas**: 6,7" de iPhone y de Android.
- **Edad**: 16+.
- **Contenido generado por usuarios**: sí, con denuncias y bloqueo.
- **Privacidad**: se recoge email, fotos, mensajes y token de avisos. No hay anuncios ni rastreo.

## 14. Cada día, después del lanzamiento

Ve a **you → staff: reports and upzzy check**. Los términos prometen mirar cada denuncia en menos de 24 horas, y Apple lo comprueba.
