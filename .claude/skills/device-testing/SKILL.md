---
name: device-testing
description: Lista de comprobación para probar Mi VistApp en el simulador de Alexa y en un Echo Show real - legibilidad a distancia, navegación, datos de ejemplo y reales, y el comportamiento de pantalla siempre visible. Úsala siempre que se termine una pantalla o una fase, se prepare una prueba en dispositivo, o el usuario diga que "no se ve bien", "se apaga" o "no cambia de pantalla" en el Echo.
---

# Pruebas en simulador y dispositivo

## Simulador (antes de tocar el dispositivo)
- Cada pantalla renderiza sin errores con datos normales, vacíos y de error.
- Los cuatro botones del menú llevan a su pantalla y marcan el botón activo.
- Textos largos (evento de 60 caracteres, ciudad larga) no rompen el diseño.
- Los tres estados del aviso de salida se ven bien.

## Echo Show real
- **Legibilidad:** mirar desde 2–3 metros. Reloj, temperatura y aviso de salida deben leerse sin acercarse.
- **Brillo y modo nocturno:** comprobar de noche; el diseño oscuro no debe deslumbrar.
- **Táctil:** los botones se pulsan a la primera con el dedo.
- **Navegación:** cambiar entre las cuatro pantallas varias veces seguidas sin que se cuelgue.

## Siempre visible
No es una función oficial de Amazon, así que se mide, no se supone.
1. Abrir la skill y no tocar nada durante 10 minutos, luego 30, luego 1 hora.
2. Anotar cuándo se cierra o vuelve al inicio del dispositivo.
3. Probar la rutina de Alexa con sensor de movimiento que la reabre y anotar cuánto tarda.
4. Repetir tras una actualización del dispositivo.
Documentar los resultados en `docs/` con modelo y fecha.

## Datos reales
- Desconectar el wifi un momento: debe mostrar "sin conexión" o el último dato marcado, no una pantalla vacía.
- Evento con ubicación a distintas distancias: la hora de salida cambia con ella.
- Calendario sin eventos: la pantalla lo indica sin parecer rota.

## Cómo informar
Resumen corto: qué se probó, en qué modelo, qué falló, captura si es posible y siguiente paso.
