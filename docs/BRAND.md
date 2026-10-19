# UPZZY: sistema visual

La idea: **etiqueta de ropa + cartel de calle.** Tipografía negra y ancha, mucho contraste, esquinas casi rectas y un solo color de acento. Nada de degradados ni tarjetas redondeadas genéricas.

## Logo

- **Marca:** un bloque sólido (como una etiqueta) con una flecha hacia arriba recortada. "UP" de UPZZY, subir, ir a más. Archivos: `assets/brand/upzzy-mark.svg` y `upzzy-mark-light.svg`.
- **Wordmark:** UPZZY en Archivo Black. Componente `Logo` en `src/components/brand/Logo.tsx`.
- Es una propuesta de trabajo. Si ya tienes logo, se sustituye en esos dos sitios y en `assets/images/`.

## Color

| Token | Oscuro | Claro | Uso |
| --- | --- | --- | --- |
| Ink | `#0E0E0E` | texto | Fondo principal en oscuro |
| Bone | texto | `#F2EFE8` | Fondo principal en claro, color "algodón crudo" |
| Signal | `#FF5A1F` | `#FF5A1F` | Único acento: acciones, Drops en directo, pestaña activa |
| Signal Deep | | `#C2410C` | Acento como texto sobre fondos claros (contraste AA) |
| Brass | `#C8A45A` | `#8A6A22` | Exclusivo de First 100 Founders |

Todos los pares texto/fondo pasan WCAG AA; lo comprueba `src/__tests__/contrast.test.ts`.

## Tipografía

- **Archivo Black / ExtraBold:** titulares en mayúsculas, interlineado apretado.
- **Inter:** texto y botones de lectura.
- **JetBrains Mono:** etiquetas, numeración (01, 02…), fases, contadores. Da el toque de "etiqueta de prenda".

## Reglas

- Las pantallas usan solo `useTheme()` y los tokens de `src/theme/tokens.ts`, nunca colores sueltos.
- Secciones numeradas con una línea gruesa encima (`Section`).
- Estados vacíos con borde discontinuo (`EmptyState`): dicen la verdad sobre lo que falta.
- Iconos propios en `src/components/brand/icons.tsx`: rejilla de 24 px, trazo 1.75, esquinas rectas.
- Fotografía (cuando llegue): luz natural, gente real, ciudad y viaje, con la prenda visible. Sin bancos de imágenes genéricos.
