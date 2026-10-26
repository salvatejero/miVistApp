import { within } from '../../lib/time';

/** Resultado de una fuente: el valor y, si no es de ahora, desde cuándo lo tenemos. */
export interface Fetched<T> {
  value: T;
  /** Presente si la fuente ha fallado o tarda, y se sirve el último dato bueno. */
  staleSince?: Date;
}

interface Entry<T> {
  value: T;
  at: number;
}

/** Entradas que no se han renovado en este tiempo se borran (agendas de días pasados, eventos viejos…). */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Guarda el último dato bueno de cada consulta. Mientras es reciente (menos de `ttlMs`) no vuelve a
 * preguntar a la fuente. Si la fuente falla, o tarda más de `waitMs` y hay un dato anterior, devuelve
 * ese dato marcado como no actualizado; la consulta lenta sigue y renueva el dato cuando termine.
 */
export class LastGood<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
    private readonly waitMs = 2000,
  ) {}

  async get(key: string, load: () => Promise<T>): Promise<Fetched<T>> {
    const entry = this.entries.get(key);
    if (entry && this.now() - entry.at < this.ttlMs) return { value: entry.value };
    const request = this.start(key, load);
    if (!entry) return { value: await request };
    const stale = { value: entry.value, staleSince: new Date(entry.at) };
    try {
      const fresh = await within(request, this.waitMs);
      return fresh ?? stale;
    } catch {
      return stale;
    }
  }

  /** Lanza la consulta, o se une a la que ya está en marcha para la misma clave. */
  private start(key: string, load: () => Promise<T>): Promise<T> {
    const running = this.pending.get(key);
    if (running) return running;
    const request = load()
      .then((value) => {
        this.entries.set(key, { value, at: this.now() });
        this.prune();
        return value;
      })
      .finally(() => this.pending.delete(key));
    request.catch(() => undefined); // si nadie la espera (respuesta ya servida con el dato viejo)
    this.pending.set(key, request);
    return request;
  }

  private prune(): void {
    const limit = this.now() - MAX_AGE_MS;
    for (const [key, entry] of this.entries) if (entry.at < limit) this.entries.delete(key);
  }
}
