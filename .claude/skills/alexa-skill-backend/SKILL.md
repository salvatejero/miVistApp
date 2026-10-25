---
name: alexa-skill-backend
description: Convenciones del backend de la skill de Alexa de Mi VistApp (TypeScript/Node, handlers, sesión, modelo de interacción es-ES, nombre de invocación, estructura de servicios, errores). Úsala siempre que se toque skill/lambda, skill/interactionModels, skill.json, un handler, un intent o el despliegue con ASK CLI, incluso si solo se pide "arreglar la skill".
---

# Backend de la skill

Antes de usar una API del SDK de Alexa o de ASK CLI que no conozcas, verifícala en la documentación oficial; las versiones cambian.

## Estructura
```
skill/lambda/
├─ src/handlers/  # un fichero por tipo de petición (lanzamiento, navegación, calendario, casa, integrados)
├─ src/services/  # DashboardData: mock ahora; cliente del VPS con caché en la Fase 3
├─ src/apl/       # pantallas, paquete compartido y respuesta con RenderDocument
└─ tests/
vps/              # servicio de datos (Fase 3): weather, calendar, traffic, home y config (umbrales, colchón, intervalos)
```

## Reglas
- Los handlers no llaman a APIs externas: piden los datos a `services/` mediante interfaces. Así se cambia mock por real sin tocar la UI.
- Cada servicio devuelve datos con la forma del contrato de `contracts/` y valida la respuesta de la API antes de usarla.
- Fallo de un servicio: devolver el último dato conocido con marca de "no actualizado", o un estado vacío explícito. Nunca lanzar un error que deje la pantalla en blanco.
- Sesión: la skill se abre en Inicio. La navegación y el refresco no cierran la sesión.
- Configuración (umbrales, intervalos, origen y destino) en `config/`, no en los handlers.
- Registros sin datos personales (direcciones, tokens, títulos de eventos).

## Modelo de interacción
- Idioma `es-ES`. Nombre de invocación: "mi panel" ("mi vistapp" se oía como "mi lista"). Alexa aplica reglas a estos nombres (por ejemplo no incluir la palabra "alexa", longitud y caracteres permitidos); comprobarlas al configurar y ajustar si se rechaza.
- Frases de ejemplo: abrir, mostrar calendario, mostrar el tiempo, mostrar la casa, ayuda, salir.
- Respuestas de voz cortas; lo importante va en pantalla.

## Pruebas
- Pruebas unitarias de handlers con peticiones de ejemplo (lanzamiento, evento de usuario de cada botón, error de servicio).
- Probar en el simulador de Alexa antes de ir al dispositivo.
- Ningún test depende de red real; las APIs se simulan.
