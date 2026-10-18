# Servicio de datos en el VPS

El VPS lee tus fuentes (iCloud, Open-Meteo, TomTom y, en el futuro, Home Assistant) y sirve a la skill el JSON de cada pantalla. Guarda tus credenciales y direcciones, y ninguna sale de ahí.

```
Echo Show → Alexa → skill (Alexa-hosted) ──HTTPS + clave──▶ Caddy :443 ──▶ servicio :8787 (solo local)
```

## Lo que necesitas

- Un VPS con Linux y **Node.js 22** o superior.
- Un **dominio o subdominio** apuntando a la IP del VPS (por ejemplo `vistapp.tudominio.com`). Alexa exige HTTPS con un certificado válido.
- **Caddy** como proxy HTTPS: pide y renueva el certificado de Let's Encrypt solo.
- Las claves de las fuentes (ver `vps/.env.example`):
  - **TomTom:** cuenta gratuita en developer.tomtom.com y una clave con Routing y Search.
  - **iCloud:** una contraseña de app en appleid.apple.com → Inicio de sesión y seguridad → Contraseñas de app. Da acceso a correo, contactos y calendario: guárdala solo en el VPS y revócala si dejas de usar la skill.
  - **Open-Meteo:** no necesita clave.

## Instalación

1. En tu ordenador, con el repo: `npm install && npm run build`. Genera `build/vps/server.cjs`, un solo fichero con todo dentro.
2. Cópialo al VPS:
   ```bash
   scp build/vps/server.cjs usuario@vps:/opt/mivistapp/server.cjs
   ```
3. En el VPS, crea un usuario sin privilegios y la configuración:
   ```bash
   sudo useradd --system --no-create-home mivistapp
   sudo mkdir -p /etc/mivistapp
   sudo cp vps.env /etc/mivistapp/vps.env      # a partir de vps/.env.example
   sudo chown root:mivistapp /etc/mivistapp/vps.env
   sudo chmod 640 /etc/mivistapp/vps.env
   ```
4. Servicio de systemd en `/etc/systemd/system/mivistapp.service`:
   ```ini
   [Unit]
   Description=Mi VistApp (servicio de datos)
   After=network-online.target

   [Service]
   User=mivistapp
   EnvironmentFile=/etc/mivistapp/vps.env
   ExecStart=/usr/bin/node /opt/mivistapp/server.cjs
   Restart=always
   NoNewPrivileges=true
   ProtectSystem=strict
   ProtectHome=true
   PrivateTmp=true

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl daemon-reload && sudo systemctl enable --now mivistapp
   journalctl -u mivistapp -f    # debe decir "escuchando en 127.0.0.1:8787 · fuentes: …"
   ```
5. Caddy, en `/etc/caddy/Caddyfile`:
   ```
   vistapp.tudominio.com {
       reverse_proxy 127.0.0.1:8787
   }
   ```
   `sudo systemctl reload caddy`.
6. Cortafuegos: abre solo 22 (SSH), 80 y 443. El puerto 8787 no debe verse desde fuera.
7. Comprueba desde tu ordenador:
   ```bash
   curl https://vistapp.tudominio.com/healthz                       # {"ok":true}
   curl -H "Authorization: Bearer TU_CLAVE" https://vistapp.tudominio.com/v1/weather
   ```

Para actualizar: `npm run build`, copia otra vez `server.cjs` y `sudo systemctl restart mivistapp`.

## Conectar la skill

1. Copia `skill/lambda/.env.example` como `skill/lambda/.env.local` con la URL del VPS y la misma clave. Ese fichero no se sube al repo, y el hook de pre-commit lo frena.
2. `npm run build`: dirá "Skill conectada al VPS".
3. Despliega `build/hosted/` en Alexa-hosted (Fase 6).

Si no pones `.env.local`, la skill usa los datos de ejemplo.

## Qué pasa cuando algo falla

| Falla | Qué se ve |
|---|---|
| Una fuente (iCloud, TomTom, Open-Meteo) | El VPS sirve su último dato bueno con "No actualizado · hh:mm"; si nunca lo tuvo, ese bloque muestra un mensaje de error |
| El VPS entero | La skill pinta lo último que guardó con "Sin conexión · actualizado a las hh:mm"; sin aviso de salida |
| El VPS y nada guardado | Cada bloque dice "Sin conexión con el servidor" |
| Un botón de casa con el VPS caído | Alexa dice "No he podido conectar con la casa" |

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

- Si la clave compartida se filtra, genera otra, cámbiala en `/etc/mivistapp/vps.env` y en `skill/lambda/.env.local`, y vuelve a desplegar las dos partes.
- Los registros no incluyen URLs (las de TomTom llevan la clave), títulos de eventos ni direcciones.
- Mantén el VPS actualizado (`unattended-upgrades` en Debian/Ubuntu).
