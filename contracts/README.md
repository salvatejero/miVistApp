# Contrato de datos

Lo que necesita cada pantalla, en JSON Schema (2020-12). La UI (APL) solo lee estos campos y los servicios solo producen estos campos.

| Esquema | Datasource APL | Fixtures |
|---|---|---|
| `schemas/home.schema.json` | `home` | `home.json`, `home-errores.json` |
| `schemas/calendar.schema.json` | `calendar` | `calendar.json` |
| `schemas/weather.schema.json` | `weather` | `weather.json` |
| `schemas/house.schema.json` | `house` | `house.json` |
| `schemas/departure-alert.schema.json` | dentro de `home.departureAlert` | `departure-alert-appear.json`, `-soon.json`, `-leave-now.json` |
| `schemas/common.schema.json` | tipos compartidos | — |

## Reglas

- **Bloques que pueden fallar:** llevan `status` (`ok`, `empty`, `error`). Con `ok`, los datos son obligatorios; con `empty` o `error`, `message` es obligatorio y la UI lo muestra en el sitio del bloque.
- **Textos ya formateados:** fechas, horas y estados llegan como texto listo para pintar (`dateLabel`, `leaveAt`, `stateLabel`). La UI no formatea.
- **Sin campos inventados:** los esquemas rechazan propiedades no declaradas.
- **Datos de ejemplo inventados:** nada de direcciones, nombres o eventos reales en los fixtures.

## Cambiar el contrato

Cambia a la vez el esquema, sus fixtures y los tipos de `skill/lambda/src/contracts.ts`. `npm test` valida cada fixture contra su esquema y la respuesta de la skill contra el de Inicio.
