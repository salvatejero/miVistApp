---
name: vistapp-design-system
description: Colores, tipografía, tamaños, espaciado y estados visuales de Mi VistApp (dashboard para Echo Show). Úsala siempre que se cree, modifique o revise cualquier pantalla, componente, documento APL o texto visible de Mi VistApp, aunque no se mencione "diseño". Es la fuente de verdad visual; el detalle está en design/.
---

# Sistema de diseño de Mi VistApp

Fuente de verdad: los bocetos de `design/` (Main, Calendario, Tiempo, Casa, Estados). Si algo de aquí contradice el boceto, gana el boceto y se corrige esta skill.

## Pantalla
- Lienzo de 1280×800 (Echo Show 8/10). También Echo Show 15 (1920×1080): las medidas de `skill/apl/shared/theme.json` se escalan solas; no escribas tamaños fijos fuera del tema.
- Menú lateral fijo de 120 px a la izquierda; contenido con relleno de 36 px (vertical) y 40 px (horizontal).
- Pensada para leerse a distancia y sin tocar: lo importante en grande, el resto secundario.

## Colores
| Uso | Valor |
|---|---|
| Fondo de pantalla | `#101519` |
| Menú lateral (fondo / borde) | `#0B0F12` / `#1F2931` |
| Tarjeta | `#182027` |
| Elemento dentro de tarjeta | `#1F2931` |
| Líneas y bordes tenues | `#2B3640` |
| Texto principal | `#F2EFE8` |
| Texto secundario | `#A9B4BC` |
| Acento ámbar | `#F2A33A` |
| Ámbar oscuro (fondo de aviso / botón activo del menú) | `#2A2113` |
| Texto sobre ámbar | `#1A1206` |
| Lluvia (barras / texto claro / fondo de aviso) | `#6CC4EA` / `#8FD3F2` / `#17303D` |
| Día de otro mes (fondo / texto) | `#151C22` / `#5C6872` |
| Icono neutro (nublado, niebla) | `#C9D2D8` |

El ámbar significa "atención o seleccionado". No lo uses como decoración.

## Tipografía
- Familia del boceto: Manrope (400, 600, 800). En APL se usa Amazon Ember Display con los mismos pesos.
- Reloj 104 px; temperatura grande 64 px; títulos de tarjeta 22 px en gris secundario; eventos 20–24 px; botones de casa 22–26 px.
- Mínimo 16 px en cualquier texto. Nada por debajo.

## Formas
- Tarjetas con radio 24 px; filas internas 14–16 px; botones del menú 20 px; píldoras 999 px.
- Botones táctiles de al menos 56 px de alto; los de casa, 112 px.

## Estados
- **Seleccionado / encendido:** fondo ámbar, texto `#1A1206`.
- **Apagado:** fondo de tarjeta, borde `#2B3640`.
- **Aviso de salida:** 1) borde ámbar fino; 2) fondo ámbar oscuro y borde grueso, cuenta atrás en grande; 3) ámbar sólido, "¡Sal ya!" enorme.
- **Dato no disponible:** mostrar `--` y una línea de estado ("sin conexión", "actualizado hace N min"), nunca un hueco vacío.

## Reglas
- Texto en español (es-ES). Fechas tipo "Jue 15 oct".
- Contraste suficiente sobre cada fondo; revisar el texto gris sobre `#182027` y el oscuro sobre ámbar.
- No introducir colores ni tamaños nuevos sin añadirlos aquí.
