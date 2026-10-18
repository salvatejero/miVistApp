# Servicio de datos en la Raspberry Pi

El servicio de datos (`vps/`) corre en una **Raspberry Pi 3B+** en casa. Lee tus fuentes (iCloud, Open-Meteo, TomTom y, en el futuro, Home Assistant) y sirve a la skill el JSON de cada pantalla. Tus credenciales y direcciones no salen de ahí.

Alexa-hosted tiene que llegar a la Raspberry por **HTTPS con un certificado válido**. Para no abrir puertos en el router ni comprar un dominio, se usa **Tailscale Funnel**: publica el servicio en una dirección `https://<nombre>.<tu-red>.ts.net` con certificado incluido, y funciona aunque tu operador no te dé IP pública.

```
Echo Show → Alexa → skill (Alexa-hosted) ──HTTPS + clave──▶ Tailscale Funnel ──▶ Raspberry Pi :8787 (solo local)
```

## Lo que necesitas

- Raspberry Pi 3B+ con fuente de alimentación oficial y una tarjeta microSD de 16 GB o más.
- **Raspberry Pi OS Lite (64 bits)**, grabada con Raspberry Pi Imager. En sus ajustes, activa SSH, pon usuario y contraseña y, si no va por cable, la wifi.
- Una cuenta gratuita de **Tailscale**.
- Las claves de las fuentes (ver `vps/.env.example`):
  - **TomTom:** cuenta gratuita en developer.tomtom.com y una clave con Routing y Search.
  - **iCloud:** una contraseña de app en appleid.apple.com → Inicio de sesión y seguridad → Contraseñas de app. Da acceso a correo, contactos y calendario: guárdala solo en la Raspberry y revócala si dejas de usar la skill.
  - **Open-Meteo:** no necesita clave.

## 1. Preparar la Raspberry

Por SSH (`ssh usuario@raspberrypi.local`):

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y unattended-upgrades        # actualizaciones de seguridad automáticas
# Node.js 22 (NodeSource; la Raspberry Pi OS de 64 bits es arm64)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version                                  # v22.x
```

La hora tiene que ser correcta (el aviso de salida depende de ella). Raspberry Pi OS la sincroniza sola; compruébalo con `timedatectl` (debe decir `System clock synchronized: yes`).

## 2. Instalar el servicio

1. En tu ordenador, con el repo: `npm install && npm run build`. Genera `build/vps/server.cjs`, un solo fichero con todo dentro (no hace falta el repo en la Raspberry).
2. Cópialo junto con el servicio de systemd:
   ```bash
   scp build/vps/server.cjs vps/deploy/mivistapp.service usuario@raspberrypi.local:/tmp/
   ```
3. En la Raspberry:
   ```bash
   sudo useradd --system --no-create-home mivistapp
   sudo mkdir -p /opt/mivistapp /etc/mivistapp
   sudo mv /tmp/server.cjs /opt/mivistapp/server.cjs
   sudo mv /tmp/mivistapp.service /etc/systemd/system/mivistapp.service
   sudo nano /etc/mivistapp/vps.env               # pega vps/.env.example y rellénalo
   sudo chown root:mivistapp /etc/mivistapp/vps.env
   sudo chmod 640 /etc/mivistapp/vps.env
   sudo systemctl daemon-reload && sudo systemctl enable --now mivistapp
   journalctl -u mivistapp -f                     # "escuchando en 127.0.0.1:8787 · fuentes: tiempo, tráfico, calendario"
   ```
   Para la clave compartida: `openssl rand -hex 32`.
4. Prueba en local:
   ```bash
   curl http://127.0.0.1:8787/healthz                                    # {"ok":true}
   curl -H "Authorization: Bearer TU_CLAVE" http://127.0.0.1:8787/v1/weather
   ```

## 3. Publicarlo con Tailscale Funnel

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up                       # abre el enlace que muestra e inicia sesión
sudo tailscale funnel --bg 8787         # si pide activar HTTPS o Funnel en tu red, sigue el enlace que muestra
tailscale funnel status                 # muestra la dirección pública: https://<nombre>.<tu-red>.ts.net
```

Funnel queda activo tras reiniciar. Comprueba desde fuera de tu red (por ejemplo, con el móvil sin wifi):

```bash
curl https://<nombre>.<tu-red>.ts.net/healthz                         # {"ok":true}
```

Esa dirección es la `VISTAPP_VPS_URL` de la skill (ver `docs/despliegue-skill.md`).

### Alternativas

- **Cloudflare Tunnel** (`cloudflared`): igual de cómodo y sin abrir puertos, pero necesita un dominio gestionado en Cloudflare.
- **Abrir el puerto 443 en el router** con un DNS dinámico (por ejemplo, DuckDNS) y Caddy para el certificado: solo si tienes IP pública (no sirve con CGNAT) y expone la Raspberry directamente.

## Actualizar

En tu ordenador: `npm run build` y `scp build/vps/server.cjs usuario@raspberrypi.local:/tmp/`. En la Raspberry: `sudo mv /tmp/server.cjs /opt/mivistapp/ && sudo systemctl restart mivistapp`.

## Cuidados de la Raspberry

- **Cortes de luz:** el servicio arranca solo al volver la corriente. Mientras la Raspberry está apagada, la skill pinta lo último guardado con "Sin conexión".
- **Tarjeta microSD:** el servicio no escribe en disco (todo va en memoria), solo los registros del sistema. Si quieres alargar la vida de la tarjeta, limita el diario: `SystemMaxUse=50M` en `/etc/systemd/journald.conf`.
- **Memoria:** el servicio usa unos 60–80 MB de los 1 GB de la 3B+. Si más adelante instalas **Home Assistant**, en una 3B+ va justo: mejor en otra máquina o en una Raspberry más nueva, y que este servicio le llame por la red local.

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

- Funnel solo publica el puerto 8787; SSH y el resto de la Raspberry no quedan expuestos a internet.
- Todo lo que no lleve la clave recibe 401. Si la clave se filtra, genera otra, cámbiala en `/etc/mivistapp/vps.env` y en `skill/lambda/.env.local`, y vuelve a desplegar las dos partes.
- Los registros no incluyen URLs (las de TomTom llevan la clave), títulos de eventos ni direcciones.
- Cambia la contraseña por defecto de la Raspberry y, si puedes, entra por SSH con clave en lugar de contraseña.
