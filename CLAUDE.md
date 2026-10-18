# Mi VistApp — instrucciones para los agentes

Skill de Alexa (APL) con un dashboard siempre visible para Echo Show. Plan completo en `PLAN.md`; diseño de referencia en `design/`; skills del proyecto en `.claude/skills/`.

## Git
- Este repositorio es **público**. Nunca subir claves, tokens, direcciones ni datos personales. Aplica la skill `secrets-privacy` antes de cada commit.
- La rama de trabajo es `develop`. Crea ramas cortas desde `develop` (`feat/…`, `fix/…`, `docs/…`) y fusiónalas en `develop`.
- **Nunca** hagas push a `main`, ni force-push, ni borres ramas protegidas. `main` solo recibe cambios por pull request desde `develop`.
- Commits pequeños con prefijo: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Si un commit con datos sensibles llega a subirse, avisa al usuario: hay que rotar la clave.

## Trabajo
- No hay CI: ejecuta los tests en local antes de cada pull request y di cuáles has pasado.
- Sigue las fases de `PLAN.md`. No adelantes fases sin avisar.
- Las decisiones abiertas de `PLAN.md` §2 se preguntan al usuario; no se asumen.
- Todo dato que muestre una pantalla pasa por el contrato de `contracts/` (skill `data-contracts`).

## Comandos
- `npm install` y luego `npm run check` (typecheck, lint, tests y build). Detalle en `docs/desarrollo.md`.
- Estructura y decisiones técnicas: `docs/arquitectura.md`. Contrato: `contracts/README.md`.

## Decisiones tomadas
<!-- Respuestas a §2 de PLAN.md -->
- **Dispositivos:** Echo Show 8/10 (1280×800) y Echo Show 15 (1920×1080). Los APL se adaptan por perfil de viewport; el diseño de `design/` es la referencia a 1280×800.
- **Uso personal:** la skill es solo para el usuario y se queda en modo desarrollo; no se publica en la tienda (decidido el 18 oct 2026, sustituye a la decisión anterior de publicarla). Aun así, nada personal en el repo: es público.
- **Idioma:** es-ES.
- **Arquitectura:** la skill (TypeScript, Node.js) vive en **Alexa-hosted** y pide los datos a un **servicio propio en un VPS en internet** (`vps/`, también TypeScript). Hablan el idioma de `contracts/` por HTTPS con una clave compartida. La skill guarda en DynamoDB la última respuesta del VPS y, si este no contesta a tiempo, pinta esos datos marcados como "sin conexión · actualizado a las hh:mm".
- **Datos personales:** direcciones de casa y trabajo, colchón y credenciales viven en el entorno del VPS, nunca en el repo ni en la skill.
- **Tiempo y lluvia:** Open-Meteo.
- **Calendario:** **Apple (iCloud, CalDAV)** leído desde el VPS con una contraseña de app guardada en su entorno. Google y Outlook, si hacen falta, se añaden también en el VPS. Investigación previa en `docs/calendario-apple.md`.
- **Tráfico y rutas:** TomTom Routing API.
- **Domótica:** Amazon no deja que una skill ni un servidor propio controlen los dispositivos vinculados a Alexa. El camino previsto es **Home Assistant** (el usuario lo está valorando), al que llamaría el VPS. Hasta entonces, la pantalla Casa usa datos de ejemplo.
