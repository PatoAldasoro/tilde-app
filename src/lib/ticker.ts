/**
 * Un tic periódico que no se frena con la pestaña en segundo plano. El navegador espacia los
 * `setInterval` de una página oculta (a uno por segundo, y después de unos minutos a uno por
 * minuto); los de un Worker siguen a su ritmo. Si el Worker no está disponible, queda el
 * intervalo común: el timer se calcula con marcas de tiempo, así que solo se actualiza más tarde.
 */
export function startTicker(onTick: () => void, intervalMs: number): () => void {
  let interval: ReturnType<typeof setInterval> | null = null;
  let worker: Worker | null = null;
  let url: string | null = null;
  const fallback = () => {
    worker?.terminate();
    worker = null;
    interval ??= setInterval(onTick, intervalMs);
  };
  try {
    const source = `setInterval(() => postMessage(0), ${Math.max(50, Math.round(intervalMs))});`;
    url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onmessage = onTick;
    worker.onerror = fallback;
  } catch {
    fallback();
  }
  return () => {
    worker?.terminate();
    if (interval) clearInterval(interval);
    if (url) URL.revokeObjectURL(url);
  };
}
