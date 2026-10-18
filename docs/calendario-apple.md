# Calendario de Apple en una skill publicada

Investigación previa a la Fase 3 (15 oct 2026).

**Decisión (18 oct 2026):** la skill pasa a ser de uso personal y los datos los sirve un VPS propio. El VPS lee iCloud por CalDAV con la contraseña de app del usuario, guardada solo en su entorno. Al no haber más usuarios, desaparecen los problemas de vinculación de cuenta y de guardar contraseñas ajenas que se describen abajo.

## Lo que hay

1. **Alexa no deja leer sus calendarios a una skill.** Aunque el usuario tenga iCloud vinculado en la app de Alexa, no hay ninguna API documentada para que una skill propia lea esos calendarios. La skill tiene que conectarse ella misma al proveedor.
2. **Apple no tiene OAuth para iCloud Calendar.** Solo hay CalDAV (`caldav.icloud.com`), con el correo del Apple ID y una **contraseña de app** que cada usuario genera a mano en appleid.apple.com (exige verificación en dos pasos). No hay API ni panel de desarrollador, y el usuario puede revocarla en cualquier momento.
3. **Esa contraseña da acceso a más que el calendario.** Una contraseña de app de iCloud también sirve para el correo y los contactos. Guardarla nos hace responsables de un dato muy sensible.
4. **No se debe pedir por voz.** Amazon prohíbe recoger por voz datos sensibles y exige política de privacidad para cualquier skill que maneje contraseñas o use vinculación de cuenta. La vía correcta es la **vinculación de cuenta** de Alexa con una página de inicio de sesión propia.
5. **Alexa-hosted no tiene web pública.** La vinculación de cuenta necesita un servidor de autorización OAuth propio con página de login en HTTPS. Alexa-hosted solo aloja la Lambda de la skill, así que hace falta un servicio web aparte (por ejemplo, AWS Lambda con URL pública o Cloudflare Workers, ambos con plan gratuito).

## Opciones

| Opción | Cómo funciona para el usuario | Qué hay que construir | Riesgos |
|---|---|---|---|
| **A. Apple con contraseña de app** | En la app de Alexa pulsa "Vincular cuenta", llega a nuestra página y escribe su Apple ID y una contraseña de app que ha generado antes | Servidor OAuth propio, almacenamiento cifrado de credenciales, cliente CalDAV | Guardamos contraseñas que abren correo y contactos; paso de configuración pesado para el usuario |
| **B. Apple con enlace público** | En iCloud marca un calendario como público, copia el enlace y lo pega en nuestra página de vinculación | Servidor OAuth propio (más sencillo), lector de ficheros iCalendar | El enlace es público: quien lo tenga ve el calendario; un enlace por calendario |
| **C. Google primero** | En la app de Alexa pulsa "Vincular cuenta" e inicia sesión con Google | Nada fuera de Alexa-hosted: Alexa habla OAuth directamente con Google | Google revisa la app por pedir acceso al calendario (trámite, sin coste) |

## Recomendación

- **Para publicar pronto:** empezar con **Google (C)**, que funciona con Alexa-hosted tal como está, y añadir Apple después.
- **Si Apple es imprescindible desde el principio:** **B** para empezar, porque no guarda contraseñas, y **A** como opción avanzada más adelante.

Cualquiera de las dos opciones de Apple añade a la arquitectura un pequeño servicio web propio, que también servirá cuando se quieran tener varios calendarios a la vez.

## Fuentes

- [Security Requirements for Alexa Skills](https://developer.amazon.com/en-US/docs/alexa/custom-skills/security-testing-for-an-alexa-skill.html)
- [Certification requirements for privacy policy URLs](https://developer.amazon.com/en-US/blogs/alexa/alexa-skills-kit/2023/02/certification-requirements-privacy-urls-feb-2023)
- [Usage Limits on Hosted Resources (Alexa-hosted)](https://developer.amazon.com/es-ES/docs/alexa/hosted-skills/usage-limits.html)
- [Apple Calendar API: read and create events (Nylas)](https://developer.nylas.com/docs/cookbook/calendar/apple-calendar-api/)
- [Apple Calendar connect (Nango)](https://nango.dev/docs/api-integrations/apple-calendar/connect)
- [How to integrate iCloud Calendar API into your app (OneCal)](https://www.onecal.io/blog/how-to-integrate-icloud-calendar-api-into-your-app)
