# Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run check      # typecheck + lint + tests + build
```

Por separado: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

No hay CI: ejecuta `npm run check` antes de cada pull request y di en el PR qué ha pasado.

## Probar en el simulador de Alexa

Mientras no esté desplegada (Fase 6), se puede ver una pantalla en la herramienta de autoría de APL de la consola de desarrolladores:

1. `npm run build`.
2. En la consola de Alexa, abre la skill → **Multimodal Responses** → **Visual** → crear desde cero.
3. Pega el documento que genera la skill. Para obtenerlo:
   ```bash
   node -e 'require("./build/hosted/lambda/index.js").handler(require("./skill/lambda/test/launch-request.json"),{}).then(r=>console.log(JSON.stringify(r.response.directives[0].document,null,2)))'
   ```
   y en **Data** pega el contenido de `contracts/fixtures/home.json` dentro de `{"home": …}`.
4. Cambia el viewport entre *Echo Show 8* y *Echo Show 15* para comprobar los dos tamaños.

## Desplegar en Alexa-hosted

Se detalla en la Fase 6. `npm run build` deja en `build/hosted/` las carpetas `skill-package/` y `lambda/` listas para copiarse al repositorio que crea Alexa-hosted.
