# Desplegar la skill y probarla (Fase 6)

La skill vive en **Alexa-hosted** (gratis, en servidores de Amazon) y queda en modo desarrollo: solo la ve tu cuenta. Antes, la Raspberry tiene que estar funcionando y publicada en su subdominio (`docs/raspberry.md`).

## 1. Crear la skill en la consola

En developer.amazon.com, con **la misma cuenta de Amazon que usa tu Echo Show**: **Alexa Developer Console → Create Skill**.

1. **Nombre:** Mi VistApp. **Idioma:** Spanish (ES).
2. **Tipo:** Other → **Custom**.
3. **Hosting:** **Alexa-hosted (Node.js)**, región **EU (Ireland)**.
4. **Plantilla:** Start from Scratch.
5. Cuando termine de crearse, copia el **Skill ID** (`amzn1.ask.skill.…`): en la lista de skills, "Copy Skill ID".

## 2. Empaquetar con la dirección de la Raspberry

En tu ordenador, con el repo:

```bash
cp skill/lambda/.env.example skill/lambda/.env.local
# Edita skill/lambda/.env.local:
#   VISTAPP_VPS_URL=https://<subdominio>
#   VISTAPP_API_KEY=<la misma clave que en /etc/mivistapp/vps.env>
npm run build      # debe decir "Skill conectada al VPS"
```

`.env.local` no se sube al repo (está en `.gitignore` y el hook de pre-commit lo frena). La clave solo acaba en el código que se despliega en Alexa-hosted, que es privado.

## 3. Desplegar

### Con ASK CLI (recomendado: repetible)

```bash
npm install -g ask-cli
ask configure                                         # inicia sesión con tu cuenta de Amazon
cd ..
ask init --hosted-skill-id amzn1.ask.skill.XXXX       # clona el repositorio de la skill, p. ej. en ./mi-vistapp
cd miVistApp
npm run deploy:hosted -- ../mi-vistapp                # copia, sube (git push) y compila el modelo de voz
```

Con el push, Alexa-hosted despliega el código (tarda uno o dos minutos; en la consola, pestaña **Code**, se ve el estado). El push no siempre compila el modelo de voz, y sin él Alexa no reconoce el nombre de invocación, así que el script lo compila con `ask smapi set-interaction-model` y espera a que termine. `npm run deploy:hosted` conserva el endpoint de la Lambda que Amazon guarda en `skill.json`; no copies ese fichero a mano.

Para actualizar más adelante: `npm run build` y `npm run deploy:hosted -- ../mi-vistapp`.

### A mano, desde la consola (sin instalar nada)

1. **Build → Interfaces:** activa **Alexa Presentation Language** y marca los perfiles **Hub Landscape Medium/Large** (Echo Show 8/10) y **Hub Landscape X-Large** (Echo Show 15). **Save Interfaces**.
2. **Build → Interaction Model → JSON Editor:** pega el contenido de `skill/skill-package/interactionModels/custom/es-ES.json`, **Save Model** y **Build Model**.
3. **Code:** **Import Code** con un zip de la carpeta `build/hosted/lambda` (`index.js`, `index.js.map` y `package.json`). Acepta sustituir los ficheros y pulsa **Deploy**.

## 4. Probar en el simulador

En la consola, pestaña **Test**, cambia "Off" por **Development**:

1. Escribe `abre mi tablero`: a la derecha se ve la pantalla. Cambia el dispositivo de la vista previa entre Echo Show 8 y Echo Show 15.
2. Prueba `muéstrame el calendario`, `pon el tiempo`, `ve a la casa` y `ayuda`.

El simulador no siempre deja tocar los botones ni simula el paso del tiempo: la navegación táctil y el refresco se prueban en el dispositivo.

## 5. Probar en el Echo Show

1. Di **"Alexa, abre mi tablero"**.
2. Sigue la lista de la skill `device-testing` y la prueba de pantalla siempre visible de `docs/siempre-visible.md`, y apunta los resultados en su tabla.
3. Crea la rutina que la reabre (pasos en `docs/siempre-visible.md`).

## Si algo no va

| Qué pasa | Dónde mirar |
|---|---|
| "Ha habido un problema con la respuesta de la skill" | Consola → **Code** → **CloudWatch Logs**: el registro dice qué falló (sin datos personales) |
| Todos los bloques dicen "Sin conexión con el servidor" | La skill no llega a la Raspberry: comprueba `curl https://<subdominio>/healthz` desde fuera de casa; si da 502, el contenedor está parado (`docker compose ps` en `~/mivistapp`) |
| En los registros de la skill aparece `HTTP 401` | La clave de `skill/lambda/.env.local` no es la de `/etc/mivistapp/vps.env` |
| Un bloque dice "Tiempo sin configurar", "Tráfico sin configurar"… | Falta esa parte en `/etc/mivistapp/vps.env`; recrea el contenedor tras cambiarlo (`docker compose up -d --force-recreate`) |
| Un bloque dice "Sin conexión con el calendario" | `docker compose logs` en `~/mivistapp`: suele ser la contraseña de app de iCloud o un nombre en `ICLOUD_CALENDARS` que no existe |
| Alexa no entiende "mi tablero" o abre otra cosa | El nombre de invocación se cambia en `es-ES.json` y se vuelve a desplegar, nunca solo en la consola (el siguiente despliegue lo pisaría). "mi vistapp" se descartó porque Alexa lo oía como "mi lista", y "mi panel" porque el Echo lo toma como un panel propio |
| La pantalla se apaga | Normal hasta medirlo: anota cuándo en `docs/siempre-visible.md` y configura la rutina |
