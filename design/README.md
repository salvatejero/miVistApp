# Diseño de referencia

Exportado del lienzo de diseño "Mi VistApp" (Echo Show, 1280×800). Cada `*.dc.html` es una pantalla; `canvas.json` es el índice del lienzo.

| Fichero | Pantalla |
|---|---|
| `Main.dc.html` | Inicio: reloj, tiempo, lluvia próximas horas, tráfico al trabajo, agenda hoy/mañana, botones de casa |
| `Calendario.dc.html` | Vista mensual + detalle del día |
| `Tiempo.dc.html` | Semana (7 columnas) + lluvia de hoy por horas |
| `Casa.dc.html` | Luces, enchufes y persianas con "Apagar todo" |
| `Estados.dc.html` | Tarjeta de aviso de salida en sus 3 estados (1280×560) |

Los textos entre corchetes (`[Hora]`, `[Evento]`, `[--°]`…) son huecos de datos, no texto final.

## Tokens visuales

| Uso | Valor |
|---|---|
| Fondo | `#101519` |
| Menú lateral | `#0B0F12`, borde `#1F2931`, ancho 120 px |
| Tarjeta | `#182027`, radio 24 px |
| Elemento de lista | `#1F2931`, radio 14 px |
| Borde suave / punteado | `#2B3640` |
| Texto principal | `#F2EFE8` |
| Texto secundario | `#A9B4BC` |
| Texto apagado | `#5C6872` |
| Acento (ámbar) | `#F2A33A`; fondo de acento `#2A2113`; texto sobre acento `#1A1206` |
| Lluvia | barras `#6CC4EA`, texto `#8FD3F2`, píldora `#17303D` |
| Tipografía | Manrope 400 / 600 / 800 |

Tamaños clave: reloj 104 px/800, temperatura 64 px, títulos de pantalla 48 px, títulos de tarjeta 22 px/600, eventos 20 px, mínimo 14 px.
