# Servicio de datos

El servicio de datos (`vps/`) lee tus fuentes (iCloud, Open-Meteo, TomTom y, en el futuro, Home Assistant) y sirve a la skill el JSON de cada pantalla. Tus credenciales y direcciones no salen de él.

Vale cualquier máquina Linux con Docker que esté siempre encendida: un VPS, un mini PC o una Raspberry Pi de 64 bits. Alexa-hosted tiene que llegar por **HTTPS con un certificado válido**, así que el servicio va detrás de un proxy inverso (Caddy, Nginx, Traefik…) que pone el certificado. El contenedor no publica puertos: solo lo alcanza el proxy por una red Docker compartida.

```
Echo Show → Alexa → skill (Alexa-hosted) ──HTTPS + clave──▶ proxy inverso (443) ──red Docker──▶ contenedor mivistapp :8787
```

## Lo que necesitas

- Un dominio o subdominio que apunte a tu servidor, con los puertos 80 y 443 abiertos hacia el proxy. Si tu IP es dinámica, un servicio de DNS dinámico.
- Las claves de las fuentes (ver `vps/.env.example`):
  - **TomTom:** cuenta gratuita en developer.tomtom.com y una clave con Routing y Search.
  - **iCloud:** una contraseña de app en appleid.apple.com → Inicio de sesión y seguridad → Contraseñas de app. Da acceso a correo, contactos y calendario: guárdala solo en el servidor y revócala si dejas de usar la skill.
  - **Open-Meteo:** no necesita clave.

## 1. Instalar el servicio

1. En tu ordenador, con el repo: `npm install && npm run build`. Genera `build/vps/server.cjs`, un solo fichero con todo dentro.
2. Cópialo junto con el compose:
   ```bash
   ssh <usuario>@<servidor> mkdir -p mivistapp
   scp build/vps/server.cjs vps/deploy/docker-compose.yml <usuario>@<servidor>:mivistapp/
   ```
3. En el servidor, el entorno (lo lee Compose como tu usuario, por eso no es de root):
   ```bash
   sudo install -d -o $USER -m 700 /etc/mivistapp
   install -m 600 /dev/null /etc/mivistapp/vps.env
   nano /etc/mivistapp/vps.env                    # pega vps/.env.example y rellénalo
   ```
   Para la clave compartida: `openssl rand -hex 32`. `HOST` y `PORT` los fija el compose.
4. Indica la red Docker de tu proxy en `~/mivistapp/.env` (por defecto, `proxy`):
   ```bash
   echo "PROXY_NETWORK=<red de tu proxy>" > ~/mivistapp/.env
   ```
   Si aún no tienes proxy, el README trae un ejemplo completo con Caddy.
5. Arráncalo y pruébalo desde dentro de la red Docker:
   ```bash
   cd ~/mivistapp && docker compose up -d
   docker compose logs -f                        # "escuchando en 0.0.0.0:8787 · fuentes: tiempo, tráfico, calendario"
   docker run --rm --network <red de tu proxy> curlimages/curl -s http://mivistapp:8787/healthz   # {"ok":true}
   ```

## 2. Publicarlo en el proxy

Añade a tu proxy un sitio para el subdominio que reenvíe todo a `mivistapp:8787`. Por ejemplo:

- **Caddy:**
  ```
  datos.tu-dominio.es {
      reverse_proxy mivistapp:8787
  }
  ```
- **Nginx** (con el certificado ya emitido):
  ```nginx
  server {
      listen 443 ssl;
      server_name datos.tu-dominio.es;
      ssl_certificate     /etc/letsencrypt/live/datos.tu-dominio.es/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/datos.tu-dominio.es/privkey.pem;

      location / {
          resolver 127.0.0.11 valid=30s;          # DNS de Docker: arranca aunque el contenedor no esté
          set $upstream http://mivistapp:8787;
          proxy_pass $upstream;
      }
  }
  ```

Comprueba desde fuera de tu red (por ejemplo, con el móvil sin wifi):

```bash
curl https://datos.tu-dominio.es/healthz                                    # {"ok":true}
curl -o /dev/null -w '%{http_code}\n' https://datos.tu-dominio.es/v1/home    # 401
```

Esa dirección es la `VISTAPP_VPS_URL` de la skill (ver `docs/despliegue-skill.md`).

## Actualizar

En tu ordenador: `npm run build && scp build/vps/server.cjs <usuario>@<servidor>:mivistapp/`. En el servidor: `cd ~/mivistapp && docker compose restart`. Tras cambiar `vps.env`, `docker compose up -d --force-recreate` (un `restart` no relee el `env_file`).

## Cuidados del servidor

- **Cortes de luz:** el contenedor arranca solo al volver la corriente (`restart: unless-stopped`). Mientras el servidor está apagado, la skill pinta lo último guardado con "Sin conexión".
- **Disco:** el servicio no escribe en disco (todo va en memoria), solo sus registros. En una Raspberry con microSD, limita los de Docker (por ejemplo, 10 MB × 3 por contenedor).
- **Memoria:** el servicio usa unos 60–80 MB y el contenedor está limitado a 128 MB. Si más adelante instalas **Home Assistant** y el servidor es pequeño, mejor en otra máquina, y que este servicio le llame por la red local.

## Qué pasa cuando algo falla

| Falla | Qué se ve |
|---|---|
| Una fuente (iCloud, TomTom, Open-Meteo) | El servicio sirve su último dato bueno con "No actualizado · hh:mm"; si nunca lo tuvo, ese bloque muestra un mensaje de error |
| TomTom, con un aviso de salida activo | El aviso sigue con el último trayecto y "estimado (hh:mm)", si tiene menos de una hora |
| El servidor o su conexión a internet | La skill pinta lo último que guardó con "Sin conexión · actualizado a las hh:mm"; sin aviso de salida |
| El servidor, sin nada guardado | Cada bloque dice "Sin conexión con el servidor" |
| Un botón de casa con el servidor caído | Alexa dice "No he podido conectar con la casa" |

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

- El contenedor no publica puertos: solo lo alcanza el proxy por la red Docker. Si tu proxy lo permite, limita las peticiones por IP.
- Todo lo que no lleve la clave recibe 401. Si la clave se filtra, genera otra, cámbiala en `/etc/mivistapp/vps.env` y en `skill/lambda/.env.local`, recrea el contenedor y vuelve a desplegar la skill.
- Los registros no incluyen URLs (las de TomTom llevan la clave), títulos de eventos ni direcciones.
- Mantén el servidor actualizado y entra por SSH con clave en lugar de contraseña.
