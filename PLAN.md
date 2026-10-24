# Mi VistApp — Plan de lanzamiento con subagentes

Repo: https://github.com/salvatejero/miVistApp.git
Estado: plan para ejecutar más adelante en Claude Code (nube). Nada de esto está implementado todavía.

## 1. Qué es

Dashboard siempre visible para Echo Show, como skill de Alexa con APL. Se invoca con "Alexa, abre mi VistApp".

Pantallas (ya diseñadas, ver `design/`):

- **Inicio:** reloj, tiempo, lluvia próximas horas, tráfico al trabajo, agenda de hoy y mañana (dos columnas), botones de casa.
- **Calendario:** vista mensual con detalle del día.
- **Tiempo:** semana (7 columnas) + lluvia de hoy por horas.
- **Casa:** luces, enchufes y persianas con "Apagar todo".
- **Aviso de salida:** tarjeta de evento con ubicación en 3 estados (aparece, falta poco, sal ya).
- **Menú lateral** con 4 botones: Inicio, Calendario, Tiempo, Casa.

Regla del aviso: `hora de salir = inicio del evento − trayecto con tráfico − colchón`. Aparece unos 30 min antes de esa hora; umbrales iniciales 30 / 10 / 0 min; colchón por defecto 10 min.

**Uso personal (18 oct 2026):** la skill es solo para el usuario y no se publica en la tienda. Los datos los sirve un servidor propio (la Raspberry Pi de casa que ya sirve otras webs, tras su Nginx compartido; en el código, «VPS»); la skill, en Alexa-hosted, guarda en caché lo último que recibió para seguir funcionando si el servidor cae. Ver §3 y `docs/arquitectura.md`.

## 2. Decisiones abiertas (confirmar antes de la Fase 1)

Resueltas entre el 15 y el 18 de octubre de 2026; las respuestas están en `CLAUDE.md` → "Decisiones tomadas". La tabla se conserva como registro de lo que se preguntó.

| Tema | Propuesta por defecto | Confirmar |
|---|---|---|
| Modelo de Echo Show | Diseño a 1280×800 (Echo Show 8/10) | Qué modelo es; el 15 usa otra resolución |
| Idioma / región | es-ES | Si también hace falta pt-PT |
| Lenguaje del backend | TypeScript (Node.js) | — |
| Hosting | Alexa-hosted al principio; AWS Lambda propia si hace falta | Si hay cuenta AWS |
| Tiempo y lluvia | Open-Meteo o AEMET (España/Portugal) | Fuente preferida |
| Calendario | Google Calendar o Microsoft Graph (Outlook/Teams) | Cuál usa |
| Tráfico y ruta | Google Routes API (tráfico en vivo) | Clave y presupuesto |
| Domótica | Por investigar (ver riesgos) | Qué dispositivos y marca |
| Dirección de casa y trabajo | Guardadas como secreto en el backend, nunca en el repo | — |

## 3. Estructura propuesta del repo

```
miVistApp/
├─ CLAUDE.md                 # reglas del proyecto para los agentes
├─ PLAN.md                   # este documento
├─ .claude/agents/           # definiciones de subagentes (ver §5)
├─ .claude/skills/           # skills del proyecto (ver §5, "Skills del proyecto")
├─ design/                   # diseño de referencia (mivistapp-diseno.zip)
├─ skill/
│  ├─ skill.json             # manifiesto de la skill (ASK CLI)
│  ├─ interactionModels/custom/es-ES.json
│  ├─ apl/                   # documentos APL (inicio, calendario, tiempo, casa)
│  └─ lambda/                # handlers, servicios, tests
├─ vps/                      # servicio de datos en el VPS: fuentes reales, credenciales y caché propia
├─ contracts/                # esquema JSON de los datasources + fixtures de ejemplo (idioma común de skill y VPS)
└─ docs/
```

## 4. Fases y paralelismo

```
Fase 0 (persona) ─▶ Fase 1 (arquitecto) ─▶ ┌ Fase 2a UI-APL ┐
                                           │ Fase 2b Backend │ ─▶ Fase 3 (datos reales, en paralelo) ─▶ Fase 4 ─▶ Fase 5 ─▶ Fase 6
                                           └ Fase 2c Contrato┘
```

### Fase 0 — Preparación (la haces tú)
- Cuenta de Alexa Developer y ASK CLI instalado, con la misma cuenta que usa el Echo Show.
- Preparar el repo (está vacío y es público): primer commit en `main` con el contenido de `mivistapp-repo-base.zip`, crear `develop` y aplicar la protección de ramas. Pasos en §9.
- Conectar GitHub a Claude Code en la nube y crear el entorno.
- Contestar las decisiones abiertas de §2.
- Subir `design/` al repo.

**Hecho cuando:** el repo tiene commit inicial y `design/`, y las decisiones están anotadas en `CLAUDE.md`.

### Fase 1 — Esqueleto (agente `arquitecto`)
- Estructura de carpetas, `CLAUDE.md`, TypeScript, lint y tests que se ejecutan en local (no hay CI).
- Skill mínima que abre la pantalla de Inicio con texto fijo.
- **Contrato de datos** en `contracts/`: esquema JSON de lo que necesita cada pantalla y datos de ejemplo.

**Hecho cuando:** `npm test` pasa y la skill responde en el simulador de Alexa.

### Fase 2 — Skill con datos de ejemplo (3 agentes en paralelo)
- **`ui-apl`:** convierte las 4 pantallas y la tarjeta de aviso a documentos APL, con el menú lateral compartido y el tema oscuro.
- **`skill-backend`:** handlers de lanzamiento, navegación entre pantallas desde el menú, modelo de interacción es-ES y nombre de invocación "mi vistapp".
- **`datos-mock`:** servicio que devuelve los datos de ejemplo según el contrato, incluidos los tres estados del aviso de salida.

**Hecho cuando:** en el simulador y en tu Echo Show se ven las cuatro pantallas con datos de ejemplo y el menú cambia de pantalla.

### Fase 3 — Datos reales
Primero, el agente `arquitecto` monta las dos piezas comunes:
- **Servicio de datos en `vps/`:** una API HTTPS con un endpoint por pantalla que devuelve el JSON del contrato, protegida con una clave compartida. Guarda el último dato bueno de cada fuente y lo sirve marcado como no actualizado si la fuente falla.
- **Cliente en la skill:** pide los datos al VPS con un tiempo máximo corto y guarda la última respuesta en DynamoDB. Si el VPS no responde, pinta lo guardado con el aviso "sin conexión · actualizado a las hh:mm".

Después, un agente por fuente, en paralelo, dentro de `vps/`:
- **`datos-tiempo`:** tiempo semanal y lluvia por horas (Open-Meteo).
- **`datos-calendario`:** hoy y mañana y vista mensual desde iCloud por CalDAV, con la contraseña de app guardada solo en el VPS.
- **`datos-trafico`:** trayecto al trabajo con tráfico en vivo (TomTom), y regla del aviso de salida con sus umbrales.
- **`datos-casa`:** estado y control de dispositivos a través de Home Assistant, cuando exista (ver riesgos).

Cada agente respeta el contrato de `contracts/` y deja pruebas con respuestas simuladas de la API.

**Hecho cuando:** cada fuente sustituye a su dato de ejemplo sin cambiar la UI, y falla con elegancia (mensaje en pantalla, no pantalla vacía) si la API no responde. Con el VPS apagado, la skill se abre y navega con los últimos datos guardados.

### Fase 4 — Siempre en pantalla (agente `siempre-visible`)
- Tiempo de inactividad largo en APL y sesión que se mantiene abierta.
- Refresco periódico de los datos sin reiniciar la pantalla.
- Documentar la rutina de Alexa (sensor de movimiento) que reabre la skill, porque eso se configura en la app de Alexa, no en código.

**Hecho cuando:** tras una hora de prueba la pantalla sigue activa, o se reabre sola, sin intervención.

### Fase 5 — Calidad (agente `revisor`)
- Revisión de código, pruebas, y secretos fuera del repo.
- Legibilidad a distancia: tamaños de texto y contraste en cada pantalla.
- Comprobación de errores: sin conexión, API caída, calendario vacío.

**Hecho cuando:** los tests pasan en local y la revisión no deja hallazgos graves abiertos.

### Fase 6 — Despliegue y prueba real (tú + `arquitecto`)
- Desplegar el servicio de datos como contenedor en la Raspberry Pi compartida, tras su Nginx con Let's Encrypt (`docs/raspberry.md`) y la skill en Alexa-hosted (`docs/despliegue-skill.md`).
- Publicar en la etapa de desarrollo de la skill, probar en el Echo Show y recoger ajustes.
- La skill se queda en modo desarrollo para uso personal. No se publica en la tienda.

## 5. Subagentes

Se definen como ficheros en `.claude/agents/<nombre>.md`. Plantilla común: rol, qué lee, qué escribe, reglas, criterio de "hecho".

| Agente | Rol | Escribe en | Reglas clave |
|---|---|---|---|
| `arquitecto` | Estructura, contrato de datos, integración | raíz, `contracts/`, scripts de pruebas | Decide interfaces y las documenta; no implementa features |
| `ui-apl` | Documentos APL a partir de `design/` | `skill/apl/` | Respeta colores, tamaños y estados del diseño; solo lee datos del contrato |
| `skill-backend` | Handlers, navegación, modelo de interacción | `skill/lambda/`, `skill/interactionModels/` | Sin llamadas a APIs externas; pide los datos a los servicios |
| `datos-mock` | Datos de ejemplo según el contrato | `skill/lambda/services/mock`, `contracts/fixtures` | Debe cubrir los 3 estados del aviso |
| `datos-tiempo` | Tiempo y lluvia | `vps/src/services/weather` | Respuestas simuladas en tests |
| `datos-calendario` | Calendario de Apple (CalDAV) | `vps/src/services/calendar` | Credenciales solo en el entorno del VPS |
| `datos-trafico` | Trayecto y regla de salida | `vps/src/services/traffic` | Umbrales configurables, no fijos en código |
| `datos-casa` | Dispositivos vía Home Assistant | `vps/src/services/home` | Solo cuando exista Home Assistant |
| `siempre-visible` | Inactividad y refresco | `skill/apl/`, `docs/` | Documentar lo que no sea código |
| `revisor` | Revisión y calidad | solo comentarios y tests | Solo lectura sobre código ajeno |

Ejemplo de cabecera para `.claude/agents/ui-apl.md`:

```markdown
---
name: ui-apl
description: Convierte el diseño de design/ en documentos APL para Echo Show. Usar cuando haya que crear o modificar pantallas.
---
Eres el especialista en APL de Mi VistApp.
- Lee `design/` y `contracts/` antes de escribir nada.
- Escribe solo en `skill/apl/`.
- Mantén colores, tipografía y tamaños del diseño; pantalla de 1280x800.
- Los datos llegan por datasources según el contrato; no inventes campos.
- Termina indicando qué pantallas están listas y cuáles faltan.
```

### Skills del proyecto

Van en `.claude/skills/<nombre>/SKILL.md` (paquete `mivistapp-skills.zip`). Dan a los agentes el conocimiento común y evitan repetirlo en cada prompt.

| Skill | Para qué | La usan |
|---|---|---|
| `vistapp-design-system` | Colores, tipografía, tamaños y estados visuales | `ui-apl`, `revisor`, `siempre-visible` |
| `apl-echo-show` | Cómo escribir APL, menú compartido, navegación y refresco | `ui-apl`, `siempre-visible` |
| `alexa-skill-backend` | Estructura del backend, sesión, modelo de interacción es-ES y pruebas | `arquitecto`, `skill-backend`, `datos-*` |
| `departure-alert` | Regla del aviso de salida, estados, umbrales y eventos que se ignoran | `datos-trafico`, `ui-apl`, `revisor` |
| `data-contracts` | Esquemas y datos de ejemplo entre UI y servicios | `arquitecto`, `datos-mock`, todos los `datos-*` |
| `secrets-privacy` | Claves, tokens, direcciones y registros | todos, y `revisor` en cada revisión |
| `device-testing` | Lista de pruebas en simulador y en Echo Show, incluida la de pantalla siempre visible | `siempre-visible`, `revisor` |

Cada agente de §5 debería nombrar en su cabecera las skills que usa. Las skills contienen datos que hay que contrastar con la documentación oficial (versión de APL, nombres de propiedades, reglas de nombres de invocación); ya lo indican en el texto.

## 6. Riesgos y cosas por verificar

- **Siempre en pantalla:** Amazon no ofrece una opción oficial. La Fase 4 es un apaño (inactividad larga, sesión abierta y rutina) y puede fallar o cambiar con actualizaciones del Echo Show. Probar pronto en el dispositivo.
- **Domótica:** una skill propia no necesariamente puede controlar otros dispositivos de la casa. Puede requerir la API de Smart Home, o una pasarela (Home Assistant u otra). Investigar antes de prometer los botones de Casa.
- **Nombre de invocación:** "mi vistapp" debe cumplir las reglas de Alexa; se valida al configurar la skill.
- **Vinculación de cuenta:** el calendario necesita OAuth con Alexa; añade un paso de configuración.
- **Privacidad:** direcciones de casa y trabajo y tokens como secretos del entorno, nunca en el repo.
- **Costes:** las APIs de tráfico y rutas pueden tener coste por consulta; limitar la frecuencia de refresco.
- **Servidor (Raspberry Pi):** HTTPS válido con el Nginx y Let's Encrypt de la Pi compartida, RAM repartida con otras webs, actualizaciones de seguridad, cortes de luz y desgaste de la microSD (ver `docs/raspberry.md`). Su API queda expuesta a internet: solo responde con la clave compartida, y nunca devuelve credenciales.
- **Caché de la skill:** si el VPS cae, la skill muestra datos que pueden tener horas; la marca de "actualizado a las hh:mm" es obligatoria para no engañar (sobre todo en el aviso de salida, que no se muestra con datos viejos de tráfico).
- **Modelos de Echo Show:** el diseño asume 1280×800; otros modelos exigen ajustes.

## 7. Definición de "hecho" para la v1

1. "Alexa, abre mi VistApp" muestra Inicio en el Echo Show.
2. El menú lateral cambia entre Inicio, Calendario, Tiempo y Casa.
3. Tiempo, agenda y tráfico salen de fuentes reales.
4. Un evento con ubicación cercana muestra el aviso en sus tres estados.
5. La pantalla permanece visible o se reabre sola.
6. Los fallos de las APIs se muestran en pantalla sin romperla.

## 8. Primer prompt para Claude Code

> Lee `PLAN.md`, `CLAUDE.md` y `design/`. Trabaja siempre sobre `develop` y respeta las reglas de Git de `CLAUDE.md`. Ejecuta la Fase 1 con el subagente `arquitecto`: crea la estructura de carpetas, el contrato de datos en `contracts/` y una skill mínima que abra la pantalla de Inicio. Antes de empezar, lista las decisiones abiertas de §2 que sigan sin respuesta y pregúntamelas. Al terminar, resume qué queda para la Fase 2.

## 9. Flujo de Git y protección del repo

El repositorio es **público**: cualquiera puede leer el historial completo y, si lo permite la configuración, proponer cambios. Todo lo que se suba queda visible para siempre.

### Ramas
- `main`: estable. Solo recibe cambios por pull request desde `develop`, con los commits firmados.
- `develop`: rama de trabajo. No se puede borrar ni reescribir; se puede empujar a ella directamente.
- Ramas cortas desde `develop` (`feat/…`, `fix/…`, `docs/…`) para cada tarea de los agentes, fusionadas en `develop`.
- Para publicar una versión: pull request de `develop` a `main` con commit de fusión (no squash, para que las ramas no diverjan) y etiqueta de versión.

### Puesta en marcha (una sola vez, la haces tú)
1. Haz el primer commit en `main` con el contenido de `mivistapp-repo-base.zip` más `PLAN.md`, `design/` y `.claude/skills/`.
2. Crea `develop` desde `main` y súbela.
3. En GitHub, en Settings → Branches, cambia la rama por defecto a `develop`.
4. En Settings → Rules → Rulesets, importa `.github/rulesets/main.json` y `.github/rulesets/develop.json`. Si GitHub rechaza algún campo, te lo indica al importar.
5. En Settings → Code security, activa secret scanning y push protection, Dependabot alerts y private vulnerability reporting.
6. En Settings → Actions → General, desactiva GitHub Actions: no hay CI y así nadie externo puede lanzar workflows en tu repo público.
7. Activa el hook local contra ficheros sensibles: `git config core.hooksPath .githooks` (viene en `mivistapp-repo-base.zip`).
8. Configura la firma de commits en tu equipo (SSH o GPG) y súbela a GitHub como clave de firma.

### Qué protege cada regla
| Regla | Efecto |
|---|---|
| Sin borrar ni reescribir `main` ni `develop` | Nadie puede hacer force-push ni eliminar la rama |
| Pull request obligatorio en `main` | Nada llega a `main` sin pasar por una revisión (aunque seas tú) |
| Commits firmados en `main` | Se puede comprobar quién hizo cada commit; las fusiones hechas en la web de GitHub salen firmadas por GitHub |
| Sin lista de excepciones | Ni el propietario puede saltarse las reglas; en una urgencia se pasa la regla a "desactivada" un momento |

### Puntos a vigilar
- **Firma en `develop`:** no la exigimos porque no sé si los commits de Claude Code en la nube salen firmados. Compruébalo con una prueba y, si salen firmados, se puede exigir también.
- **Una regla no impide subir un secreto:** solo el escáner y la disciplina. Si pasa, hay que rotar la clave aunque se borre el commit.
- **Fusiones desde `develop`:** con el pull request obligatorio en `main`, solo tú decides cuándo se publica.
- **Revisión de otra persona:** el ruleset pide 0 aprobaciones porque trabajas solo (GitHub no deja aprobar tu propio PR). Si entra alguien más, se sube a 1.
- **Sin CI:** nada comprueba automáticamente los tests ni los ficheros sensibles antes de fusionar. Los tests se ejecutan en local antes de cada pull request, el hook local frena ficheros como `.env`, y la red de seguridad real es secret scanning con push protection. Si más adelante quieres CI, se añade un workflow y se vuelve a exigir la comprobación en el ruleset de `main`.
