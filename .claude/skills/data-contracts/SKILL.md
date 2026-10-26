---
name: data-contracts
description: Cómo definir y cambiar el contrato de datos entre la interfaz APL y los servicios de Mi VistApp (esquemas JSON, datos de ejemplo, validación). Úsala siempre que se añada o cambie un dato que muestra una pantalla, se cree un servicio nuevo, se editen ficheros de contracts/ o aparezca un campo que "no sabemos de dónde sale".
---

# Contratos de datos

El contrato es el acuerdo entre quien dibuja (UI) y quien trae los datos (servicios). Vive en `contracts/`.

## Contenido
- `contracts/schemas/*.json`: un esquema por datasource (inicio, calendario, tiempo, casa, aviso de salida).
- `contracts/fixtures/*.json`: datos de ejemplo válidos para cada esquema.
- Fixtures obligatorios: datos normales, datos vacíos, datos de error y los tres estados del aviso de salida.

## Reglas
- Nunca inventes un campo en la UI o en un servicio. Si hace falta uno nuevo, se añade primero al esquema.
- Cada campo indica unidad y formato (por ejemplo minutos como entero, hora local en ISO). Los valores que pueden faltar se declaran como opcionales o nulos y la UI los trata.
- Los textos de fecha y hora ("Jue 15 oct", "09:30") llegan ya formateados en la zona horaria del usuario: APL no puede escribir nombres de días ni meses en español. Las marcas de tiempo técnicas (`generatedAt`) van en ISO con zona horaria.
- Un servicio y su UI se cambian en el mismo PR que el contrato.

## Flujo de cambio
1. Editar el esquema.
2. Actualizar los fixtures para que sigan siendo válidos.
3. Actualizar el servicio real y el mock.
4. Actualizar el documento APL.
5. Pasar la validación de esquemas.

## Pruebas
- Un test valida cada fixture contra su esquema.
- Un test valida la salida de cada servicio (mock y real, con respuestas simuladas) contra el esquema.
