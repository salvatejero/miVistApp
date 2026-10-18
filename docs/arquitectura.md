# Arquitectura

```
Echo Show ──▶ Alexa ──▶ Skill (Alexa-hosted) ──HTTPS + clave──▶ Servicio de datos (VPS, vps/)
                          │        │                              ├─ calendario iCloud (CalDAV)
                          │        └─ DynamoDB: última respuesta   ├─ tiempo (Open-Meteo)
                          │           del VPS (caché)              ├─ tráfico (TomTom)
                          │                                        └─ casa (Home Assistant, futuro)
                          │
                          ├─ handlers/      un fichero por tipo de petición: lanzamiento, navegación, calendario, casa, integrados
                          ├─ apl/           pantallas (documento + datasource), paquete compartido y respuesta
                          └─ services/      DashboardData: de dónde salen los datos de cada pantalla
                              ├─ mock/      datos de ejemplo (contracts/fixtures)
                              └─ shared/    rejilla del mes y textos en español
```

## Piezas

| Ruta | Qué es |
|---|---|
| `skill/skill-package/` | Manifiesto (`skill.json`) y modelo de interacción `es-ES`. Es la carpeta `skill-package` de un proyecto ASK. |
| `skill/apl/` | Documentos APL, uno por pantalla. `shared/` es el paquete común: `theme.json` (colores y medidas), `styles.json`, `graphics.json` (iconos) y `layouts.json` (menú, filas de agenda, tarjeta de aviso, botones…). |
| `skill/lambda/src/` | Código TypeScript del backend. Punto de entrada: `index.ts` (`handler`). |
| `skill/lambda/tests/` | Tests (Vitest), incluida la validación de los documentos APL. |
| `contracts/` | Contrato entre UI y servicios. Ver `contracts/README.md`. |
| `scripts/build.mjs` | Empaqueta todo en `build/hosted/` con la estructura de un repositorio Alexa-hosted. |
| `scripts/preview.ts` | `npm run preview`: documentos y datos de ejemplo para la herramienta de autoría de APL. |

## Skill y VPS (decidido el 18 oct 2026; Fase 3)

- **La skill no guarda credenciales ni llama a APIs externas.** Pide a `vps/` el JSON de cada pantalla, que ya cumple el contrato.
- **Caché en la skill.** Cada respuesta buena del VPS se guarda en DynamoDB. Si el VPS no contesta en 5 s, la skill pinta lo guardado y cada bloque lo indica ("Sin conexión · actualizado a las hh:mm"). El aviso de salida no se muestra con datos de tráfico viejos.
- **Caché en el VPS.** El VPS guarda el último dato bueno de cada fuente y no vuelve a preguntar mientras es reciente (minutos configurables); si una API falla, lo sirve con "No actualizado · hh:mm".
- **Acciones.** Los botones de casa llegan al VPS; si no responde, Alexa dice que no ha podido conectar y la pantalla se vuelve a pintar.
- Sin `skill/lambda/.env.local` al empaquetar, la skill usa `MockDashboardData` en lugar del VPS.
- Montaje y API del VPS: `docs/vps.md`.
- Pantalla siempre visible, refresco y rutina de Alexa: `docs/siempre-visible.md`.

## Primera carga (precarga y esqueletos)

Alexa da una sola respuesta por petición, así que al abrir la skill, tocar el menú o cambiar de mes la carga va en dos pasos:

1. La skill espera hasta 0,8 s (`preloadAfterMs`). Si los datos llegan antes, pinta la pantalla normal.
2. Si no, responde enseguida con una pantalla provisional:
   - **Precargada:** lo último guardado de esa pantalla, con "Actualizando…" en cada bloque y sin aviso de salida.
   - **Esqueleto:** si no hay nada guardado, cada módulo con `status: "loading"`, que la UI pinta como bloques grises (`Hueso`) mientras el contenido late.
3. La pantalla provisional manda `refresh` al montarse; el backend espera a los datos (hasta 5 s y, si no, la caché con "Sin conexión") y pinta la pantalla definitiva.

Los refrescos periódicos y los botones de casa no usan este camino: la pantalla actual se queda hasta que llegan los datos nuevos.

| Ruta | Qué es |
|---|---|
| `vps/src/server.ts` | API HTTP con la clave compartida |
| `vps/src/dashboard.ts` | Compone cada pantalla desde las fuentes, con el último dato bueno de cada una (`last-good.ts`) |
| `vps/src/services/` | Fuentes: `weather` (Open-Meteo), `traffic` (TomTom y regla del aviso de salida), `calendar` (iCloud CalDAV), `home` (de ejemplo hasta Home Assistant) |
| `vps/src/config.ts` | Variables de entorno del VPS (`vps/.env.example`) |
| `skill/lambda/src/services/vps/` | Cliente del VPS y caché en DynamoDB |
| `lib/` | Código común de skill y VPS: textos en español, rejilla del mes y horas con zona horaria |
| `contracts/types.ts` | Tipos del contrato e interfaz `DashboardData`, compartidos |

## Decisiones

- **La UI no calcula nada.** El backend manda textos ya formateados (`dateLabel`, `leaveAt`…); APL solo los pinta. Así las reglas (aviso de salida, formatos de fecha) se prueban en TypeScript.
- **La hora la pinta el dispositivo** con `localTime`, para que el reloj avance sin pedir nada al backend.
- **Cada bloque puede fallar solo.** Tiempo, lluvia, tráfico, agenda y casa llevan `status`; si no es `ok`, la pantalla muestra `message` en ese bloque y el resto sigue funcionando.
- **Un tema, dos tamaños.** Los documentos usan recursos (`@textClock`, `@gap`…). Las medidas están a 1280x800 en `theme.json`; al enviar el documento se añade una segunda versión multiplicada por `xlScale` que APL aplica cuando `viewport.width >= 1920` (Echo Show 15).
- **Paquete compartido sin `import`.** APL solo importa paquetes publicados en una URL. Para no depender de alojar ficheros, `withShared` copia tema, estilos, iconos y componentes en cada documento al enviarlo. El efecto es el mismo: se cambian una vez y afectan a todas las pantallas.
- **Navegación.** Cada botón lanza un `SendEvent` (`navigate`, `calendar.month`, `house.toggle`, `house.allOff`); el backend responde pintando la pantalla que toca. Por voz, `ShowScreenIntent` con el slot `pantalla`.
- **Estado de la sesión.** El mes que se ve en Calendario y, mientras sea de ejemplo, el estado de la casa viven en los atributos de sesión.
- **Todo en un fichero.** esbuild empaqueta código, documentos APL y dependencias en `lambda/index.js`, así Alexa-hosted no necesita compilar TypeScript ni instalar nada.
- **Fuentes intercambiables.** Los handlers solo conocen `DashboardData`. En la Fase 3 cada fuente real sustituye a su parte del mock.

## Tipografía

El diseño usa Manrope, pero APL en Echo Show solo dispone de las fuentes de Amazon. Se usa `Amazon Ember Display` con los mismos pesos (400, 600, 800).
