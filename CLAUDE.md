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

## Decisiones tomadas
<!-- Respuestas a §2 de PLAN.md -->
- **Dispositivos:** Echo Show 8/10 (1280×800) y Echo Show 15 (1920×1080). Los APL se adaptan por perfil de viewport; el diseño de `design/` es la referencia a 1280×800.
- **Publicación:** la skill se publicará en la tienda de Alexa (cambia la Fase 6 de `PLAN.md`). Consecuencias: varios usuarios, nada personal fijo en el código (direcciones y preferencias por usuario), política de privacidad y certificación de Amazon.
- **Idioma:** es-ES.
- **Backend:** TypeScript (Node.js).
- **Tiempo y lluvia:** Open-Meteo.
- **Calendario:** Google Calendar, Outlook / Microsoft 365 (Microsoft Graph) y Apple (iCloud, CalDAV).
- **Tráfico y rutas:** TomTom Routing API.
- **Domótica:** solo dispositivos vinculados a Alexa. Pendiente de investigar si una skill propia puede controlarlos (ver `PLAN.md` §6).
