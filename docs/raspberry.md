# Servicio de datos en la Raspberry Pi

El servicio de datos (`vps/`) corre en la **Raspberry Pi de casa que ya sirve otras webs** (Pi 3B, 1 GB, Raspberry Pi OS de 64 bits, con Docker). Lee tus fuentes (iCloud, Open-Meteo, TomTom y, en el futuro, Home Assistant) y sirve a la skill el JSON de cada pantalla. Tus credenciales y direcciones no salen de ahí.

Alexa-hosted tiene que llegar por **HTTPS con un certificado válido**. Lo pone el **Nginx que ya tiene la Pi** (multi-site, Let's Encrypt, DNS dinámico), en un subdominio propio. El servicio es un contenedor más, sin puertos publicados, en la red Docker que comparte con ese Nginx.

```
Echo Show → Alexa → skill (Alexa-hosted) ──HTTPS + clave──▶ Nginx de la Pi (443) ──red-publica──▶ contenedor mivistapp :8787
```

Las piezas de fuera de este repo: el Nginx y los certificados los lleva el repo de cagodromo; el `server` del subdominio, el repo stsc (`nginx/{sites,servidores-http,servidores-tls}/<subdominio>.conf`).

## Lo que necesitas

- El subdominio dado de alta en el DynDNS de IONOS (la `updateUrl` vive en la Pi, en `/etc/cagodromo/dyndns.url`).
- Las claves de las fuentes (ver `vps/.env.example`):
  - **TomTom:** cuenta gratuita en developer.tomtom.com y una clave con Routing y Search.
  - **iCloud:** una contraseña de app en appleid.apple.com → Inicio de sesión y seguridad → Contraseñas de app. Da acceso a correo, contactos y calendario: guárdala solo en la Raspberry y revócala si dejas de usar la skill.
  - **Open-Meteo:** no necesita clave.

## 1. Instalar el servicio

1. En tu ordenador, con el repo: `npm install && npm run build`. Genera `build/vps/server.cjs`, un solo fichero con todo dentro.
2. Cópialo junto con el compose:
   ```bash
   ssh <usuario>@<pi> mkdir -p mivistapp
   scp build/vps/server.cjs vps/deploy/docker-compose.yml <usuario>@<pi>:mivistapp/
   ```
3. En la Pi, el entorno (lo lee Compose como tu usuario, por eso no es de root):
   ```bash
   sudo install -d -o $USER -m 700 /etc/mivistapp
   install -m 600 /dev/null /etc/mivistapp/vps.env
   nano /etc/mivistapp/vps.env                    # pega vps/.env.example y rellénalo
   ```
   Para la clave compartida: `openssl rand -hex 32`. `HOST` y `PORT` los fija el compose.
4. Arráncalo y pruébalo desde dentro de la red Docker:
   ```bash
   cd ~/mivistapp && docker compose up -d       # nunca con --remove-orphans
   docker compose logs -f                        # "escuchando en 0.0.0.0:8787 · fuentes: tiempo, tráfico, calendario"
   docker run --rm --network red-publica curlimages/curl -s http://mivistapp:8787/healthz   # {"ok":true}
   ```

## 2. Publicarlo en el Nginx compartido

1. En el repo stsc, los tres ficheros del subdominio (copia de los de atmlebrija, con un único `location /` hacia `mivistapp:8787`). Mérgealos a `main` y haz `git pull` en su clon de la Pi.
2. Certificado y `server` del 443 (en la Pi):
   ```bash
   sudo ~/cagodromo/deploy/raspserver/emitir-certificado.sh <subdominio>
   cd ~/stsc/nginx/servidores-tls && cp <subdominio>.conf.plantilla <subdominio>.conf
   cd ~/cagodromo/docker && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate nginx
   ```
3. Comprueba desde fuera de casa (por ejemplo, con el móvil sin wifi):
   ```bash
   curl https://<subdominio>/healthz                                    # {"ok":true}
   curl -o /dev/null -w '%{http_code}\n' https://<subdominio>/v1/home    # 401
   ```

Esa dirección es la `VISTAPP_VPS_URL` de la skill (ver `docs/despliegue-skill.md`).

## Actualizar

En tu ordenador: `npm run build && scp build/vps/server.cjs <usuario>@<pi>:mivistapp/`. En la Pi: `cd ~/mivistapp && docker compose restart`. Tras cambiar `vps.env`, `docker compose up -d --force-recreate` (un `restart` no relee el `env_file`).

## Cuidados de la Raspberry

- **Cortes de luz:** el contenedor arranca solo al volver la corriente (`restart: unless-stopped`). Mientras la Raspberry está apagada, la skill pinta lo último guardado con "Sin conexión".
- **Tarjeta microSD:** el servicio no escribe en disco (todo va en memoria), solo sus registros, que Docker ya limita en la Pi (10 MB × 3 por contenedor).
- **Memoria:** el servicio usa unos 60–80 MB y el contenedor está limitado a 128 MB; la Pi la comparte con otras webs y su base de datos. Si más adelante instalas **Home Assistant**, en esta Pi no cabe: mejor en otra máquina o en una Raspberry más nueva, y que este servicio le llame por la red local.

## Qué pasa cuando algo falla

| Falla | Qué se ve |
|---|---|
| Una fuente (iCloud, TomTom, Open-Meteo) | La Raspberry sirve su último dato bueno con "No actualizado · hh:mm"; si nunca lo tuvo, ese bloque muestra un mensaje de error |
| TomTom, con un aviso de salida activo | El aviso sigue con el último trayecto y "estimado (hh:mm)", si tiene menos de una hora |
| La Raspberry o tu conexión a internet | La skill pinta lo último que guardó con "Sin conexión · actualizado a las hh:mm"; sin aviso de salida |
| La Raspberry, sin nada guardado | Cada bloque dice "Sin conexión con el servidor" |
| Un botón de casa con la Raspberry caída | Alexa dice "No he podido conectar con la casa" |

## API

Todas las rutas salvo `/healthz` exigen `Authorization: Bearer <VISTAPP_API_KEY>`. Las respuestas cumplen `contracts/`.

| Ruta | Devuelve |
|---|---|
| `GET /healthz` | `{"ok": true}` |
| `GET /v1/home` | Inicio |
| `GET /v1/calendar?offset=N` | Calendario, N meses desde el actual |
| `GET /v1/weather` | Tiempo |
| `GET /v1/house` | Casa |
| `POST /v1/house/toggle` `{"id": "…"}` | Enciende o apaga un dispositivo |
| `POST /v1/house/all-off` | Apaga todo |

## Seguridad

- El contenedor no publica puertos: solo lo alcanza el Nginx por la red Docker. El Nginx limita peticiones por IP.
- Todo lo que no lleve la clave recibe 401. Si la clave se filtra, genera otra, cámbiala en `/etc/mivistapp/vps.env` y en `skill/lambda/.env.local`, recrea el contenedor y vuelve a desplegar la skill.
- Los registros no incluyen URLs (las de TomTom llevan la clave), títulos de eventos ni direcciones.
- Cambia la contraseña por defecto de la Raspberry y, si puedes, entra por SSH con clave en lugar de contraseña.
