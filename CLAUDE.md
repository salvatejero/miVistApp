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
<!-- Rellenar aquí las respuestas a §2 de PLAN.md -->
