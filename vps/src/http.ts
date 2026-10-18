/** fetch inyectable para poder simular las APIs en los tests. */
export type Fetch = typeof fetch;

export class SourceError extends Error {
  override name = 'SourceError';
}

/** Tiempo máximo de cada consulta a una fuente: la skill espera al VPS 5 s en total. */
export const SOURCE_TIMEOUT_MS = 3000;

/** fetch con tiempo máximo, para librerías que no lo ponen (tsdav). */
export const fetchWithTimeout =
  (fetchFn: Fetch, timeoutMs = SOURCE_TIMEOUT_MS): Fetch =>
  (input, init) =>
    fetchFn(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) });

/** Pide JSON con un tiempo máximo; cualquier respuesta no 2xx es un error de la fuente. */
export async function getJson(fetchFn: Fetch, url: string, timeoutMs = SOURCE_TIMEOUT_MS): Promise<unknown> {
  const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  if (!response.ok) throw new SourceError(`HTTP ${response.status}`);
  return response.json();
}
