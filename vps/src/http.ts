/** fetch inyectable para poder simular las APIs en los tests. */
export type Fetch = typeof fetch;

export class SourceError extends Error {
  override name = 'SourceError';
}

/** Pide JSON con un tiempo máximo; cualquier respuesta no 2xx es un error de la fuente. */
export async function getJson(fetchFn: Fetch, url: string, timeoutMs = 8000): Promise<unknown> {
  const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
  if (!response.ok) throw new SourceError(`HTTP ${response.status}`);
  return response.json();
}
