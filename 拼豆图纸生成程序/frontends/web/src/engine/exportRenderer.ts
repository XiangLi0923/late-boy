import { renderBlueprint, type RenderTask } from './blueprintRenderer';

interface WorkerResult {
  ok: boolean;
  blob?: Blob;
  error?: string;
}

/**
 * Render/compress a blueprint off the UI thread when possible.
 * Falls back to the same rendering code on the main thread.
 */
export function renderBlueprintAsync(task: RenderTask): Promise<Blob> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return renderBlueprint(task);
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./blueprintWorker.ts', import.meta.url), { type: 'module' });
    const fallback = (error?: string) => {
      renderBlueprint(task).then(resolve, reject);
      if (error) console.warn('后台导出不可用，已切换为主线程导出:', error);
    };

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      worker.terminate();
      if (event.data.ok && event.data.blob) {
        resolve(event.data.blob);
      } else {
        fallback(event.data.error);
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      fallback(event.message);
    };
    worker.postMessage(task);
  });
}
