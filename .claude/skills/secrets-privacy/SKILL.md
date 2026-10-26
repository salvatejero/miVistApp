---
name: secrets-privacy
description: Manejo de claves de API, tokens OAuth, direcciones de casa y trabajo y datos de calendario en Mi VistApp. Úsala siempre que se añada una integración externa, se toque configuración, variables de entorno, vinculación de cuenta, registros o cualquier dato personal, y antes de cada commit que incluya configuración.
---

# Secretos y privacidad

## Nunca en el repo
- Claves de API, tokens de acceso o de refresco, secretos de cliente OAuth.
- Direcciones de casa y de trabajo, coordenadas, títulos o asistentes de eventos reales.
- Ficheros `.env` con valores reales. Se versiona solo un `.env.example` con nombres y valores falsos.

## Dónde van
- Entorno de ejecución de la skill: variables de entorno o gestor de secretos del hosting elegido (el mecanismo exacto depende de si es Alexa-hosted o AWS; comprobarlo al decidirlo).
- Direcciones: configuración privada del entorno, no del código.
- Tokens de calendario: los gestiona la vinculación de cuentas de Alexa; no se copian a ningún fichero.

## Registros y errores
- No registrar tokens, direcciones ni contenido de eventos.
- Los mensajes de error en pantalla son genéricos ("sin conexión con el calendario"); el detalle técnico va solo a registros sin datos personales.

## Datos de ejemplo
- Los fixtures usan direcciones y eventos inventados y claramente falsos.

## Antes de cada commit
- Revisar el diff en busca de claves, direcciones o tokens.
- Si algo sensible llegó a commitearse, hay que rotar la clave; borrarlo del último commit no basta.

## Cuando falte permiso
Pedir al usuario que cree o rote la clave; no intentar obtener credenciales por otros medios.
