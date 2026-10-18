---
name: apl-echo-show
description: Cómo escribir y organizar documentos APL (Alexa Presentation Language) para las pantallas de Mi VistApp en Echo Show - layouts, menú lateral compartido, datasources, navegación entre pantallas, refresco y mantener la pantalla activa. Úsala siempre que se cree, edite o depure un documento APL, un RenderDocument, un SendEvent o cualquier cosa de la carpeta skill/apl, aunque el usuario solo diga "la pantalla del Echo".
---

# APL para Mi VistApp

Antes de escribir, lee `vistapp-design-system` y el contrato de `contracts/`. Antes de usar una propiedad de APL que no conozcas, compruébala en la documentación oficial de APL y la versión soportada por el dispositivo; no la des por buena de memoria.

## Organización
- Un documento por pantalla: `inicio`, `calendario`, `tiempo`, `casa`. El aviso de salida es un componente dentro de Inicio y Calendario, no una pantalla.
- Menú lateral, estilos, iconos y componentes comunes en `skill/apl/shared/`; el backend los copia en cada documento al enviarlo (`withShared`), porque `import` exige publicar el paquete en una URL.
- Los datos entran por **datasources**, nunca escritos en el documento. Los nombres de campo salen del contrato.
- Documento y datasource se envían juntos en la directiva de renderizado.

## Navegación
- Cada botón del menú lanza un `SendEvent` con un argumento (`inicio`, `calendario`, `tiempo`, `casa`).
- El backend recibe el evento de usuario y responde renderizando el documento de esa sección.
- El botón de la pantalla actual se marca con el estado "seleccionado" del diseño (ámbar oscuro).

## Pantalla siempre visible
- Declarar un tiempo de inactividad largo en los ajustes del documento y mantener la sesión abierta desde el backend. Es un apaño, no una función oficial; ver `device-testing`.
- Refresco de datos con un comando temporizado o actualizando datasources desde el backend, sin recargar todo el documento.
- No bloquear ni deshabilitar toda interacción: el menú debe seguir siendo tocable.

## Estructura de cada pantalla
- Contenedor raíz a pantalla completa (`100vw` × `100vh`), menú y relleno con los recursos del tema, para que sirva a 1280×800 y a 1920×1080.
- Texto que pueda desbordar: limitar líneas y usar elipsis; no dejar que rompa el layout (títulos de eventos largos).
- Imágenes e iconos: vectoriales si es posible. No cargar recursos remotos sin necesidad.

## Comprobaciones
- Renderizar con el contenido más largo y con datos vacíos.
- Que ningún texto baje de 16 px.
- Que la pantalla funcione sin tocar nada (solo lectura) y con el menú.
