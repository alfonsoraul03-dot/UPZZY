# Plan

## Ahora: una app simple, divertida y adictiva

Tres pestañas:

| Pestaña | Qué es |
| --- | --- |
| **today** | *Daily oops*: 10 cuadrículas, el mismo reto para todo el mundo cada día, un intento al día. Racha de días, resultado para compartir sin spoilers (estilo Wordle). |
| **play** | *Spot the oops* sin fin: cada cuadrícula es perfecta menos una cosa. Tiempo por ronda, 3 vidas, cada vez más difícil. Récord personal. |
| **drop** | Drop 001 (slip tee, offset tee, typo hoodie) con enlace a la tienda de upzzyworld.com. Precios y stock se ven en la web, no se copian en la app. |

Todo funciona sin conexión. El progreso (récord, racha, resultado del día) se guarda solo en el móvil.

## Siguiente (propuesto)

1. **Cuentas y ranking real**: login con Supabase y clasificación del daily. Las puntuaciones se validarían en el servidor para que no se puedan inventar.
2. **Recompensas**: por ejemplo, un código de descuento por rachas de 7 días o acceso anticipado al siguiente drop. Necesita el paso 1 para no regalar nada con datos falsos.
3. **Oops photo challenge**: una foto al día con la cámara de la app.
4. Notificaciones: "the daily oops is out."

## Base técnica que ya existe

- Expo SDK 57 + TypeScript + Expo Router.
- Supabase listo para el paso 1: migración con perfiles, roles de staff y registro de auditoría, con tests de seguridad (`npm run test:db`).
