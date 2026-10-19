# Plan de implementación

El repositorio estaba vacío, así que UPZZY empieza desde cero con Expo + TypeScript + Supabase, como propone el prompt maestro. Cada fase termina con type check, tests y estas notas actualizadas.

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Sistema visual, arquitectura, navegación, esquema base y seguridad | **Hecha** |
| 2 | Login (email + Apple/Google), perfiles editables, borrar cuenta, First 100 por compras verificadas | Siguiente |
| 3 | Challenges con cámara obligatoria, subida segura, galerías, validación y moderación | |
| 4 | Feed social, amistades, likes, comentarios, notificaciones push | |
| 5 | UPZZY Drops: programación aleatoria, reclamación atómica, envío | |
| 6 | Competición mensual, retos globales, rankings con auditoría | |
| 7 | Meetups, mensajes directos y chats de grupo (incluido el chat privado First 100) | |
| 8 | Tienda conectada a Shopify, pedidos, fidelización | |
| 9 | Creator Club, selección mensual, productos oficiales y comisiones | |
| 10 | Panel de administración completo, revisión de seguridad, preparación para App Store / Google Play | |

## Ajuste de orden propuesto

**First 100 se mueve de la Fase 2 a la Fase 8.** Las plazas de fundador dependen de pedidos *pagados y verificados*, y esos datos llegan con la integración de la tienda (webhooks de Shopify). En la Fase 2 dejaría listo el modelo de datos y la función de asignación atómica con sus tests, y la conexión con los pedidos reales se activa en la Fase 8. Así nunca se asigna una plaza con datos falsos.

## Fase 1: qué hay

- **Funciona de punta a punta:** las 5 pestañas, la tienda como modal desde el botón *Store*, modo claro/oscuro, fuentes de la marca, comprobación real de conexión con Supabase en *Profile*.
- **Base de datos (probada):** perfiles creados automáticamente al registrarse, visibilidad pública / miembros / privada, roles de staff (admin, moderador) que solo un admin puede dar, y un registro de auditoría que no se puede editar ni borrar.
- **Pendiente a propósito:** el resto de pantallas muestran estados vacíos honestos con la fase en la que llegan. No hay datos inventados ni botones que no hagan nada.
- **Tests:** contraste de colores (WCAG AA) en ambos temas, validación de configuración (impide usar la clave secreta en la app), reglas de username, y 9 bloques de tests de seguridad SQL sobre la migración.

## Decisiones abiertas para Raul

- Textos de la app en inglés (marca internacional). Se puede añadir español más adelante.
- Tienda: Shopify (ya hay conector). Se confirmará en la Fase 8.
- Login: email con código + Sign in with Apple + Google en la Fase 2.
