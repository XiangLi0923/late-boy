import { renderBlueprint, type RenderTask } from './blueprintRenderer';

const scope = self as unknown as Worker;

scope.onmessage = async (event: MessageEvent<RenderTask>) => {
  try {
    const blob = await renderBlueprint(event.data);
    scope.postMessage({ ok: true, blob });
  } catch (err) {
    scope.postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
