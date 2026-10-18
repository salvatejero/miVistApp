import { longDateLabel } from '../../../../lib/labels';
import { zoned } from '../../../../lib/time';
import type { HomeScreen } from '../contracts';
import type { ScreenId } from './screens';

const loading = { status: 'loading' as const };

/** Datos de una pantalla sin nada todavía: cada módulo se pinta como esqueleto. */
export function loadingContent(screen: ScreenId, now: Date, timeZone: string): unknown {
  if (screen !== 'inicio') return loading;
  const today = zoned(now, timeZone);
  const home: HomeScreen = {
    generatedAt: now.toISOString(),
    header: { dateLabel: longDateLabel(today.year, today.month, today.day) },
    weather: loading,
    rainForecast: loading,
    commute: loading,
    agenda: loading,
    house: loading,
    departureAlert: null,
  };
  return home;
}
