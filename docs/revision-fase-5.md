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

Revisión del agente `revisor`; cada hallazgo se comprobó en el código antes de arreglarlo y cada arreglo tiene su test.

| # | Gravedad | Hallazgo | Estado |
|---|---|---|---|
| G1 | Grave | Una fuente lenta o colgada (sobre todo iCloud) hacía que el VPS tardara más de 5 s y la skill pintara Inicio entero como "Sin conexión" | **Arreglado.** Cada consulta a una fuente tiene 3 s como máximo (también CalDAV). Si la fuente tarda más de 2 s y hay un dato anterior, se sirve ese con "No actualizado · hh:mm" mientras la consulta termina en segundo plano. Cada bloque tiene un plazo de 3,5 s. Un bloque lento ya no tumba al resto |
| G2 | Grave | Botón de casa con el VPS caído: 5 s de la acción + 5 s para volver a pintar > 8 s de Alexa | **Arreglado.** Si la acción falla, la pantalla se pinta con lo guardado sin volver a esperar al VPS, y Alexa dice que no ha podido conectar |
| M1 | Media | El refresco se encadenaba de documento en documento: una respuesta perdida lo paraba para siempre, y un error hacía hablar a Alexa sin que nadie preguntara | **Arreglado.** El refresco usa `handleTick` (se repite mientras el documento esté en pantalla). Los refrescos que fallan no hablan, y los errores que informa el dispositivo solo se registran |
| M2 | Media | "Reunión de Microsoft Teams", "Zoom"… sin enlace contaban como lugar físico; la geocodificación aceptaba cualquier resultado | **Arreglado.** Se detectan también por nombre. La geocodificación busca a menos de 100 km de casa con confianza mínima, y se descartan trayectos de más de 3 h |
| M3 | Media | (a) Si TomTom falla, el aviso se oculta en vez de mostrarse como estimado (la skill `departure-alert` dice lo segundo). (b) Solo se probaba el primer evento con ubicación | (b) **Arreglado:** se prueban hasta 3 eventos. (a) **Pendiente de decidir** (ver abajo) |
| M4 | Media | Un evento diario creado hace años perdía sus ocurrencias de este mes | **Arreglado.** El límite solo cuenta ocurrencias dentro del rango |
| M5 | Media | DynamoDB sin tiempos máximos podía hacer que una respuesta buena superara los 8 s | **Arreglado.** Tiempos cortos en el cliente y 1 s como máximo por lectura o escritura |
| M6 | Media | La caché vieja de la skill mostraba la fecha y el "Hoy" del día en que se guardó | **Arreglado.** La cabecera lleva siempre la fecha de hoy; si lo guardado es de otro día, la agenda dice que no hay conexión |
| m1 | Menor | La tarjeta de tráfico calculaba mal la hora de salida los días de cambio de hora, y por la tarde mostraba la de la mañana ya pasada | **Arreglado.** Hora civil correcta y, pasada la entrada de hoy, la de mañana |
| m2 | Menor | Un nombre mal escrito en `ICLOUD_CALENDARS` parecía un calendario vacío | **Arreglado.** Da error y el bloque lo dice |
| m3 | Menor | Zona horaria fija en la skill | **Arreglado.** `VISTAPP_TIMEZONE` en `skill/lambda/.env.local` |
| m4 | Menor | El aviso podía aparecer hasta 5 min tarde | **Arreglado.** Refresco cada minuto si hoy hay un evento con salida calculada |
| m5 | Menor | La URL del VPS podía ser `http://` y la clave viajaría en claro | **Arreglado.** El build falla si no es `https://` |
| m6 | Menor | "Hoy" y "Ahora" del tiempo se fijaban al pedir la previsión | **Arreglado.** Se calculan al componer la pantalla |
| m7 | Menor | Echo Show 15 en vertical usa las medidas de 1280×800 | **Pendiente.** Fuera del alcance de la v1: el diseño es horizontal |
| m8 | Menor | Con error en otro mes, el título del calendario no dice qué mes | **Pendiente.** Menor; se deja para más adelante |
| m9 | Menor | La memoria del VPS crecía con claves de días pasados | **Arreglado.** Se borran las entradas de más de 48 h y la caché de lugares tiene un máximo |

### Decisión pendiente (M3a)

Cuando TomTom no responde y el último trayecto conocido tiene más de unos minutos, hay dos opciones:

1. **Ocultar el aviso** (como está ahora): nunca se avisa con un tráfico que puede haber cambiado.
2. **Mostrarlo como estimado** (lo que dice la skill `departure-alert`): se avisa con el último trayecto y la etiqueta "Estimado · hh:mm".

La caché de la skill (VPS caído) lo oculta siempre; esta decisión es solo para cuando falla TomTom con el VPS funcionando.

## Tiempos de respuesta

Alexa corta a los 8 s. Peor caso tras los arreglos:

| Camino | Peor caso |
|---|---|
| Abrir o navegar | 0,8 s de espera + hasta 1 s de lectura de caché, y se pinta la provisional |
| Refresco | VPS hasta 5 s (el VPS responde en unos 3,5 s como mucho) + hasta 1 s para guardar en caché |
| Botón de casa con el VPS caído | 5 s de la acción + hasta 1 s de lectura de caché |
