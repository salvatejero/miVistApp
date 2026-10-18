# Revisión de la Fase 5

Fecha: 18 de octubre de 2026. Estado de `develop` revisado: commit `497745a`.

## Comprobaciones automáticas

| Qué | Resultado |
|---|---|
| `npm run check` (tipos, lint, tests, build) | Pasa: 158 tests |
| Validador oficial de APL en las 4 pantallas | Sin errores; solo el aviso conocido de tamaños en porcentaje dentro de contenedores flexibles (ver `docs/desarrollo.md`) |
| Campos que leen las pantallas | Todos existen en el contrato (test de `apl.test.ts`) |
| Texto mínimo | 16 dp; ningún tamaño del tema por debajo |

## Secretos y datos personales

Se ha buscado en **todo el historial** de git (todas las ramas), no solo en el estado actual:

- Claves de API, contraseñas, tokens y claves privadas: ninguna.
- Ficheros `.env`, `.pem`, `.key` o `id_rsa` en algún commit: ninguno (solo los `.env.example` con valores falsos).
- Correos, direcciones y coordenadas reales: ninguno. Los fixtures usan datos inventados ("Calle Falsa 1", "Ciudad de ejemplo").
- `skill/lambda/.env.local` y `build/` están en `.gitignore`, y el hook de pre-commit frena los `.env`.

## Contraste (legibilidad a distancia)

Relación de contraste WCAG de cada combinación de color del tema. Mínimo 4,5 para texto normal y 3 para texto grande o iconos.

| Combinación | Contraste |
|---|---|
| Texto principal sobre fondo / tarjeta / fila | 16,0 / 14,4 / 12,9 |
| Texto secundario sobre fondo / tarjeta / fila / menú | 8,7 / 7,8 / 7,0 / 9,1 |
| Ámbar sobre fondo / tarjeta / fila / ámbar oscuro | 8,8 / 7,9 / 7,1 / 7,6 |
| Texto oscuro sobre ámbar ("¡Sal ya!", botones encendidos) | 8,9 |
| Estado de un botón de casa (opacidad 0,8) encendido / apagado | 6,0 / 9,6 |
| Texto de lluvia sobre tarjeta / píldora | 10,0 / 8,4 |
| Días de otro mes en el calendario | **3,0**: justo en el mínimo de texto grande (22 dp en negrita). Es intencionado (deben verse apagados), pero conviene mirarlo en el dispositivo |
| Esqueleto de carga sobre tarjeta / fondo | 1,24 / 1,38: sutil a propósito; si en el Echo Show no se distingue, subir `colorSkeleton` |

## Hallazgos de la revisión de código

(Se completa con el resultado del agente `revisor` y los arreglos aplicados.)
