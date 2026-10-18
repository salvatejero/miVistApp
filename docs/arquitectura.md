# Arquitectura

```
Echo Show ──▶ Alexa ──▶ Skill (Alexa-hosted) ──HTTPS + clave──▶ Servicio de datos (VPS, vps/)
                          │        │                              ├─ calendario iCloud (CalDAV)
                          │        └─ DynamoDB: última respuesta   ├─ tiempo (Open-Meteo)
                          │           del VPS (caché)              ├─ tráfico (TomTom)
                          │                                        └─ casa (Home Assistant, futuro)
                          │
                          ├─ handlers/      peticiones de Alexa (lanzamiento, intents, eventos APL)
                          ├─ screens/       arma la respuesta de cada pantalla: documento APL + datasource
                          ├─ services/      DashboardData: de dónde salen los datos de cada pantalla
                          │   └─ mock/      datos de ejemplo (contracts/fixtures)
                          └─ apl.ts         une el tema compartido con cada documento
```

## Piezas

| Ruta | Qué es |
|---|---|
| `skill/skill-package/` | Manifiesto (`skill.json`) y modelo de interacción `es-ES`. Es la carpeta `skill-package` de un proyecto ASK. |
| `skill/apl/` | Documentos APL, uno por pantalla. `shared/theme.json` tiene colores y medidas para 1280x800 y 1920x1080. |
| `skill/lambda/src/` | Código TypeScript del backend. Punto de entrada: `index.ts` (`handler`). |
| `skill/lambda/test/` | Tests (Vitest). |
| `contracts/` | Contrato entre UI y servicios. Ver `contracts/README.md`. |
| `scripts/build.mjs` | Empaqueta todo en `build/hosted/` con la estructura de un repositorio Alexa-hosted. |

## Skill y VPS (decidido el 18 oct 2026, se implementa en la Fase 3)

- **La skill no guarda credenciales ni llama a APIs externas.** Pide a `vps/` el JSON de cada pantalla, que ya cumple el contrato.
- **Caché en la skill.** Cada respuesta buena del VPS se guarda en DynamoDB. Si el VPS no contesta en un tiempo corto (del orden de 1–2 s), la skill pinta lo guardado y cada bloque lo indica ("sin conexión · actualizado a las hh:mm"). El aviso de salida no se muestra con datos de tráfico viejos.
- **Caché en el VPS.** El VPS guarda el último dato bueno de cada fuente; si una API falla, lo sirve marcado como no actualizado.
- **Acciones.** Los botones de casa llegan al VPS como peticiones; si el VPS no responde, la skill avisa en pantalla de que no se pudo hacer.
- Hasta la Fase 3, `MockDashboardData` sustituye al VPS.

## Decisiones

- **La UI no calcula nada.** El backend manda textos ya formateados (`dateLabel`, `leaveAt`…); APL solo los pinta. Así las reglas (aviso de salida, formatos de fecha) se prueban en TypeScript.
- **La hora la pinta el dispositivo** con `localTime`, para que el reloj avance sin pedir nada al backend.
- **Cada bloque puede fallar solo.** Tiempo, lluvia, tráfico, agenda y casa llevan `status`; si no es `ok`, la pantalla muestra `message` en ese bloque y el resto sigue funcionando.
- **Un tema, dos tamaños.** Los documentos usan recursos (`@textClock`, `@gap`…) que cambian con `viewport.width >= 1920`. El tema se inyecta en cada documento al enviarlo (`withTheme`).
- **Todo en un fichero.** esbuild empaqueta código, documentos APL y dependencias en `lambda/index.js`, así Alexa-hosted no necesita compilar TypeScript ni instalar nada.
- **Fuentes intercambiables.** Los handlers solo conocen `DashboardData`. En la Fase 3 cada fuente real sustituye a su parte del mock.

## Tipografía

El diseño usa Manrope, pero APL en Echo Show solo dispone de las fuentes de Amazon. Se usa `Amazon Ember Display` con los mismos pesos (400, 600, 800).
