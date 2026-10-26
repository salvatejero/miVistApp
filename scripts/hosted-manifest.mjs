// Mezcla el manifiesto del repo con el que tiene la skill en Alexa-hosted. Alexa-hosted guarda en su
// skill.json el endpoint de su Lambda (apis.custom.endpoint y regions); si se pisara, la skill dejaría
// de responder. Del repo se toma todo lo demás.

/** @param {any} ours manifiesto del repo  @param {any} hosted manifiesto actual de Alexa-hosted */
export function mergeManifest(ours, hosted) {
  const merged = structuredClone(ours);
  const hostedCustom = hosted?.manifest?.apis?.custom ?? {};
  const custom = (merged.manifest.apis.custom ??= {});
  if (hostedCustom.endpoint) custom.endpoint = hostedCustom.endpoint;
  if (hostedCustom.regions) custom.regions = hostedCustom.regions;
  // Secciones que el repo no define (por ejemplo, privacyAndCompliance rellenada en la consola) se conservan.
  for (const [key, value] of Object.entries(hosted?.manifest ?? {})) {
    if (!(key in merged.manifest)) merged.manifest[key] = value;
  }
  return merged;
}
