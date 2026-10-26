import { startOfDay } from '../../lib/time';
import { loadConfig } from './config';
import { VpsDashboard } from './dashboard';
import { ICloudCalendar } from './services/calendar/caldav';
import { MockHouse } from './services/home/mock-house';
import { TomTom } from './services/traffic/tomtom';
import { OpenMeteo } from './services/weather/open-meteo';
import { createApi } from './server';

const config = loadConfig();
const dashboard = new VpsDashboard(config, {
  weather: config.home ? new OpenMeteo(fetch, config.home, config.timeZone) : undefined,
  tomtom: config.tomtomApiKey ? new TomTom(fetch, config.tomtomApiKey) : undefined,
  calendar: config.icloud ? new ICloudCalendar(config.icloud, (day) => startOfDay(day, config.timeZone)) : undefined,
  house: new MockHouse(),
});

const enabled = [config.home && 'tiempo', config.tomtomApiKey && 'tráfico', config.icloud && 'calendario'].filter(Boolean);
createApi(dashboard, config.apiKey).listen(config.port, config.host, () => {
  console.log(`Mi VistApp (VPS) escuchando en ${config.host}:${config.port} · fuentes: ${enabled.join(', ') || 'ninguna'}`);
});
