// Configuración de la skill. La URL del VPS y la clave se inyectan al empaquetar (scripts/build.mjs lee
// skill/lambda/.env.local, que no se sube al repo) y acaban solo en el código desplegado en Alexa-hosted.
// Sin ellas, la skill usa los datos de ejemplo.

declare const __VISTAPP_VPS_URL__: string | undefined;
declare const __VISTAPP_API_KEY__: string | undefined;
declare const __VISTAPP_TIMEZONE__: string | undefined;

const injected = (value: string | undefined): string | undefined => (value ? value : undefined);

export const config = {
  vpsUrl: injected(typeof __VISTAPP_VPS_URL__ === 'undefined' ? process.env.VISTAPP_VPS_URL : __VISTAPP_VPS_URL__),
  apiKey: injected(typeof __VISTAPP_API_KEY__ === 'undefined' ? process.env.VISTAPP_API_KEY : __VISTAPP_API_KEY__),
  /** Tiempo máximo de espera al VPS antes de pintar la caché (Alexa corta a los 8 s). */
  vpsTimeoutMs: 5000,
  /**
   * Al abrir o cambiar de pantalla, si los datos tardan más que esto se pinta enseguida lo guardado
   * ("Actualizando…") o el esqueleto de cada módulo, y la pantalla pide los datos sola al aparecer.
   */
  preloadAfterMs: 800,
  /** Cada cuánto pide la pantalla datos nuevos mientras está visible. */
  refreshMinutes: 5,
  /** Con un aviso de salida en pantalla, cada minuto: la cuenta atrás tiene que moverse. */
  alertRefreshMinutes: 1,
  /**
   * Sin toques ni órdenes de voz durante este tiempo, la skill se cierra sola y sin hablar en el siguiente
   * refresco (los refrescos no cuentan como uso). También es la inactividad que se pide al Echo Show,
   * como respaldo si un refresco no llega.
   */
  idleTimeoutMs: 15 * 60 * 1000,
  /** Zona horaria para "actualizado a las hh:mm"; la misma que VISTAPP_TIMEZONE en el VPS. */
  timeZone:
    injected(typeof __VISTAPP_TIMEZONE__ === 'undefined' ? process.env.VISTAPP_TIMEZONE : __VISTAPP_TIMEZONE__) ?? 'Europe/Madrid',
  /** Tabla que crea Alexa-hosted para la skill (clave de partición `id`). */
  dynamoTable: process.env.DYNAMODB_PERSISTENCE_TABLE_NAME,
  dynamoRegion: process.env.DYNAMODB_PERSISTENCE_REGION,
};
