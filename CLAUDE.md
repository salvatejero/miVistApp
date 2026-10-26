# Mi VistApp — instrucciones para los agentes

Skill de Alexa (APL) con un dashboard siempre visible para Echo Show. Plan completo en `PLAN.md`; diseño de referencia en `design/`; skills del proyecto en `.claude/skills/`.

## Git
- Este repositorio es **público**. Nunca subir claves, tokens, direcciones ni datos personales. Aplica la skill `secrets-privacy` antes de cada commit.
- La rama de trabajo es `develop`. Crea ramas cortas desde `develop` (`feat/…`, `fix/…`, `docs/…`) y llévalas a `develop` por pull request.
- **Nunca** hagas push a `main` ni a `develop`, ni force-push, ni borres ramas protegidas. Un ruleset de GitHub lo impide: ambas solo reciben cambios por pull request, y `main` solo desde `develop`.
- Commits pequeños con prefijo: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Si un commit con datos sensibles llega a subirse, avisa al usuario: hay que rotar la clave.

## Trabajo
- No hay CI: ejecuta los tests en local antes de cada pull request y di cuáles has pasado.
- Sigue las fases de `PLAN.md`. No adelantes fases sin avisar.
- Las decisiones abiertas de `PLAN.md` §2 se preguntan al usuario; no se asumen.
- Todo dato que muestre una pantalla pasa por el contrato de `contracts/` (skill `data-contracts`).

## Comandos
- `npm install` y luego `npm run check` (typecheck, lint, tests y build). Detalle en `docs/desarrollo.md`.
- Estructura y decisiones técnicas: `docs/arquitectura.md`. Contrato: `contracts/README.md`. Servidor de datos: `docs/raspberry.md`. Despliegue de la skill: `docs/despliegue-skill.md`.
- `npm run build` genera la skill (`build/hosted/`) y el servicio de datos (`build/vps/server.cjs`). La URL del servidor y la clave de la skill van en `skill/lambda/.env.local`, que nunca se sube. `npm run deploy:hosted -- <repo de Alexa-hosted>` copia la skill conservando su endpoint, la sube y compila el modelo de voz.

## Decisiones tomadas
<!-- Respuestas a §2 de PLAN.md -->
- **Dispositivos:** Echo Show 8/10 (1280×800) y Echo Show 15 (1920×1080). Los APL se adaptan por perfil de viewport; el diseño de `design/` es la referencia a 1280×800.
- **Uso personal:** la skill es solo para el usuario y se queda en modo desarrollo; no se publica en la tienda (decidido el 18 oct 2026, sustituye a la decisión anterior de publicarla). Aun así, nada personal en el repo: es público.
- **Idioma:** es-ES.
- **Arquitectura:** la skill (TypeScript, Node.js) vive en **Alexa-hosted** y pide los datos a un **servicio propio** (`vps/`, también TypeScript) que corre como contenedor en la **Raspberry Pi de casa que ya sirve otras webs**, publicado por HTTPS en un subdominio propio tras su **Nginx compartido** (decidido el 24 oct 2026, sustituye a Tailscale Funnel; la carpeta conserva el nombre `vps/`). Hablan el idioma de `contracts/` por HTTPS con una clave compartida. La skill guarda en DynamoDB la última respuesta del VPS y, si este no contesta a tiempo, pinta esos datos marcados como "sin conexión · actualizado a las hh:mm".
- **Terminología:** en el código y la documentación, «VPS» es el servidor de datos (`vps/`), que hoy corre en la Raspberry Pi.
- **Datos personales:** direcciones de casa y trabajo, colchón y credenciales viven en el entorno del servidor (`/etc/mivistapp/vps.env` en la Raspberry), nunca en el repo ni en la skill.
- **Tiempo y lluvia:** Open-Meteo.
- **Calendario:** **Apple (iCloud, CalDAV)** leído desde el VPS con una contraseña de app guardada en su entorno. Google y Outlook, si hacen falta, se añaden también en el VPS. Investigación previa en `docs/calendario-apple.md`.
- **Tráfico y rutas:** TomTom Routing API.
- **Domótica:** Amazon no deja que una skill ni un servidor propio controlen los dispositivos vinculados a Alexa. El camino previsto es **Home Assistant** (el usuario lo está valorando), al que llamaría el VPS. Hasta entonces, la pantalla Casa usa datos de ejemplo.
