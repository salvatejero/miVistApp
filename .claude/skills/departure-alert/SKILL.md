---
name: departure-alert
description: Regla del aviso de salida de Mi VistApp - cuándo aparece, cómo se calcula la hora de salir con el tráfico, los tres estados, qué eventos se ignoran y cómo se recalcula. Úsala siempre que se implemente, modifique, pruebe o diseñe algo relacionado con el tráfico, la hora de salir, el tiempo de trayecto al destino de un evento o la tarjeta de aviso.
---

# Aviso de salida

## Fórmula
`horaDeSalir = inicioDelEvento − trayectoConTráfico − colchón`
`minutosParaSalir = horaDeSalir − ahora`

## Estados (valores iniciales, siempre configurables)
| Estado | Condición | Presentación |
|---|---|---|
| Oculto | más de 30 min para salir, o evento ya empezado | evento normal en la agenda |
| 1 · Aparece | entre 30 y 10 min | borde ámbar fino; "Sal a las hh:mm" |
| 2 · Falta poco | entre 10 y 0 min | fondo ámbar oscuro; cuenta atrás en grande |
| 3 · Sal ya | 0 o menos, antes del inicio | ámbar sólido; "¡Sal ya!" y hora de llegada |

Umbrales (30, 10, 0) y colchón (10 min por defecto) viven en la configuración, no en el código de la regla.

## Qué eventos cuentan
- Solo eventos con ubicación física.
- Ignorar ubicaciones que sean enlaces o nombres de reunión (Teams, Meet, Zoom, "videollamada", "online"…) o texto no geocodificable.
- Considerar el siguiente evento con ubicación que aún no haya empezado; si no se puede situar (la geocodificación busca a menos de 100 km de casa y con confianza mínima), probar el siguiente, hasta 3.
- Descartar trayectos de más de 3 h: el lugar está mal situado.

## Cálculo del trayecto
- Origen por defecto: casa. Decisión abierta: usar otro origen según la hora del día o la ubicación del dispositivo. No cambiarlo sin confirmarlo.
- Servicio de rutas con tráfico en vivo: TomTom Routing API (decidido). El modo por defecto es en coche.
- Recalcular cada pocos minutos solo cuando el evento esté cerca de entrar en la ventana de aviso; fuera de ella, con baja frecuencia, para controlar el coste.
- Si la API falla: mantener el último trayecto conocido y marcarlo como estimado (`estimatedAt`, la tarjeta dice "estimado (hh:mm)"), solo si tiene menos de una hora. Con el VPS caído no hay aviso.

## Tarjeta de tráfico al trabajo
Pieza aparte del aviso: ruta habitual, estado del tráfico, minutos de trayecto y hora de salir. Mismo servicio de rutas, con el destino de trabajo configurado.

## Implementación
- La regla es una función pura: recibe evento, trayecto, colchón, umbrales y la hora actual; devuelve estado y minutos. Sin llamadas a red dentro.
- Zona horaria configurable; no asumir una fija.
- Pruebas obligatorias: cada estado, los límites exactos (30, 10, 0), evento sin ubicación, enlace de reunión, evento ya empezado, trayecto que empeora, fallo de la API.
