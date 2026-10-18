# Pantalla siempre visible

Amazon no tiene una opción oficial para dejar una skill fija en pantalla. Mi VistApp combina tres cosas para acercarse; hay que medir en el Echo Show cuánto aguanta (ver "Prueba en el dispositivo").

## Cómo funciona

1. **Inactividad larga.** Cada pantalla pide al Echo Show 24 horas de inactividad antes de cerrarse (`settings.idleTimeout` en el documento APL). Es una sugerencia: el dispositivo puede imponer un máximo menor.
2. **Refresco periódico.** Mientras está en pantalla, cada documento manda un evento `refresh` cada pocos minutos (`handleTick` de APL). El backend lo contesta pintando la misma pantalla con datos nuevos. Si una respuesta se pierde o falla, el siguiente tick vuelve a intentarlo, y un refresco fallido nunca hace hablar a Alexa. Además de traer datos frescos, cuenta como actividad y mantiene la sesión abierta.
3. **Rutina de Alexa que la reabre.** Si la skill se cierra (otra skill toma la pantalla, un reinicio, el límite del dispositivo), una rutina la vuelve a abrir. Esto se configura en la app de Alexa, no en código (ver abajo).

## Cada cuánto se actualiza cada cosa

| Qué | Cada cuánto | Dónde se cambia |
|---|---|---|
| Reloj | Al minuto, en el propio Echo Show (no consulta nada) | — |
| Pantalla completa | Cada 5 min | `refreshMinutes` en `skill/lambda/src/config.ts` |
| Inicio con aviso de salida activo, o con un evento de hoy con salida calculada | Cada minuto, para que el aviso aparezca a su hora y la cuenta atrás avance | `alertRefreshMinutes` |
| Tiempo y lluvia en el VPS | Pide datos nuevos a Open-Meteo como mucho cada 15 min | `VISTAPP_REFRESH_WEATHER_MINUTES` |
| Tráfico en el VPS | Pide datos nuevos a TomTom como mucho cada 5 min | `VISTAPP_REFRESH_TRAFFIC_MINUTES` |
| Calendario en el VPS | Pide datos nuevos a iCloud como mucho cada 5 min | `VISTAPP_REFRESH_CALENDAR_MINUTES` |

El refresco de la pantalla no multiplica las consultas a las APIs: entre medias, el VPS responde con lo que ya tiene. Con un aviso activo, la cuenta atrás se recalcula cada minuto con el último trayecto, de hasta 5 minutos de antigüedad.

Al tocar un botón, la pantalla se pinta al momento con datos actuales y el ciclo de refresco vuelve a empezar.

## Límites conocidos

- **Al refrescar, la pantalla se vuelve a pintar entera.** APL no permite cambiar los datos de un documento ya pintado salvo en listas especiales, así que se envía el documento de nuevo. Puede notarse un parpadeo breve.
- **Si hablas con Alexa para otra cosa** (otra skill, una pregunta), Mi VistApp puede cerrarse. La rutina la reabre.
- **Actualizaciones del Echo Show** pueden cambiar cuánto respeta la inactividad. Repite la prueba tras cada actualización.

## Rutina de Alexa para reabrirla

En la app de Alexa: **Más → Rutinas → +**.

1. **Nombre:** Mi VistApp.
2. **Cuándo:** elige una (o crea varias rutinas):
   - **Movimiento** (detección de presencia del Echo Show, si tu modelo lo ofrece, o un sensor de movimiento vinculado a Alexa): reabre la skill al pasar por delante.
   - **Programación:** cada día a la hora en que te levantas, para tenerla puesta por la mañana.
3. **Acción:** **Personalizado** → escribe `abre mi vistapp`.
4. **Desde:** el Echo Show donde quieres verla.
5. Guarda y prueba la rutina desde la app (botón de reproducir).

Si la rutina por movimiento salta muy a menudo, añade en **Cuándo** una franja horaria (por ejemplo, de 7:00 a 23:00) para que no encienda la pantalla de noche.

### Ajustes útiles del Echo Show

- **Ajustes → Pantalla → Brillo adaptable:** activado, para que el tema oscuro no deslumbre de noche.
- **Ajustes → Pantalla → Modo nocturno:** si quieres atenuarla a ciertas horas.

## Prueba en el dispositivo

Sigue la lista de la skill `device-testing` y apunta aquí los resultados (modelo, versión del software del Echo y fecha).

1. Abre la skill y no toques nada: anota si sigue a los 10 min, a los 30 min y a la hora.
2. Comprueba que los datos cambian solos (por ejemplo, la hora de "actualizado" o la lluvia).
3. Habla con Alexa para otra cosa y anota si Mi VistApp se cierra.
4. Prueba la rutina: cierra la skill, provoca el disparador y mide cuánto tarda en volver.
5. Apaga el VPS: la pantalla debe seguir refrescándose con "Sin conexión · actualizado a las hh:mm".

| Fecha | Modelo y software | 10 min | 30 min | 1 h | Tras hablar con Alexa | Rutina (segundos) | Notas |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
