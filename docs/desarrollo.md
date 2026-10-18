# Desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run check      # typecheck + lint + tests + build
```

Por separado: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

No hay CI: ejecuta `npm run check` antes de cada pull request y di en el PR qué ha pasado.

## Probar las pantallas en el simulador de Alexa

Mientras la skill no esté desplegada (Fase 6), cada pantalla se puede ver en la herramienta de autoría de APL de la consola de desarrolladores:

1. `npm run preview`. Deja en `build/preview/`:
   - `<pantalla>.apl.json`: el documento completo, con el tema, los iconos y los componentes compartidos ya incluidos.
   - `<variante>.data.json`: los datos de cada caso (normal, errores, textos largos, los 3 estados del aviso…).
2. En la consola de Alexa: **Multimodal Responses** → **Visual** → crear desde cero.
3. Pega `<pantalla>.apl.json` en la pestaña **APL** y una de sus variantes en **DATA**.
4. Cambia el dispositivo de la vista previa entre **Echo Show 8** (1280×800) y **Echo Show 15** (1920×1080).

| Pantalla | Variantes de datos |
|---|---|
| `inicio` | `inicio`, `inicio-aviso-aparece`, `inicio-aviso-falta-poco`, `inicio-aviso-sal-ya`, `inicio-errores`, `inicio-textos-largos` |
| `calendario` | `calendario`, `calendario-sin-eventos`, `calendario-error` |
| `tiempo` | `tiempo`, `tiempo-error` |
| `casa` | `casa`, `casa-vacio` |

En la herramienta de autoría los botones no hacen nada: la navegación necesita la skill desplegada. Lo que hay que mirar es la lista de `device-testing` (simulador): que nada se corte ni se solape, que los textos largos acaben en puntos suspensivos y que los mensajes de error ocupen el sitio del bloque.

### Validación automática

`npm test` pasa cada pantalla por el validador oficial de APL (`apl-suggester`). Solo se acepta un aviso: tamaños en porcentaje dentro de contenedores cuyo tamaño sale del reparto flexible (`grow`). El validador no puede calcularlos sin renderizar; en el simulador es lo primero que hay que comprobar. Los tests también comprueban que cada pantalla solo lee campos del contrato, que todos los recursos e iconos existen y que ningún texto baja de 16 dp.

## Desplegar en Alexa-hosted

Se detalla en la Fase 6. `npm run build` deja en `build/hosted/` las carpetas `skill-package/` y `lambda/` listas para copiarse al repositorio que crea Alexa-hosted.
