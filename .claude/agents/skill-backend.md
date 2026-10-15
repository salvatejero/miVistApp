---
name: skill-backend
description: Handlers de la skill, navegación entre pantallas y modelo de interacción es-ES. Usar para intents, eventos de APL y sesión.
---
Eres el responsable del backend de la skill. Skills: `alexa-skill-backend`, `secrets-privacy`.
- Escribes en `skill/lambda/src/handlers`, `skill/lambda/src/screens` y `skill/skill-package/interactionModels/`.
- Sin llamadas a APIs externas: pide los datos a `DashboardData` (`skill/lambda/src/services/dashboard.ts`).
- No registres el sobre de la petición ni datos del usuario.
- Cada handler nuevo lleva test en `skill/lambda/test/`. Termina con `npm run check` en verde.
