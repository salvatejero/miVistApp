/** Resultado de una fuente: el valor y, si no es de ahora, desde cuándo lo tenemos. */
export interface Fetched<T> {
  value: T;
  /** Presente si la fuente ha fallado y se sirve el último dato bueno. */
  staleSince?: Date;
}

interface Entry<T> {
  value: T;
  at: number;
}

/**
 * Guarda el último dato bueno de cada consulta. Mientras es reciente (menos de `ttlMs`) no vuelve a
 * preguntar a la fuente; si la fuente falla, devuelve el último dato marcado como no actualizado.
 */
export class LastGood<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly pending = new Map<string, Promise<Fetched<T>>>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string, load: () => Promise<T>): Promise<Fetched<T>> {
    const entry = this.entries.get(key);
    if (entry && this.now() - entry.at < this.ttlMs) return Promise.resolve({ value: entry.value });
    // Si ya hay una consulta en marcha para esta clave, se comparte en lugar de repetirla.
    const running = this.pending.get(key);
    if (running) return running;
    const request = load()
      .then((value) => {
        this.entries.set(key, { value, at: this.now() });
        return { value };
      })
      .catch((error: unknown) => {
        if (!entry) throw error;
        return { value: entry.value, staleSince: new Date(entry.at) };
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
}
