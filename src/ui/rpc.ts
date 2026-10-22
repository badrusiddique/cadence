export type RpcRequest = { id: string; method: string; params?: Record<string, unknown> };
export type RpcResponse = { id: string; ok: boolean; result?: unknown; error?: string };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

declare global {
  interface Window {
    cadenceAcquireVsCodeApi?: () => { postMessage: (msg: unknown) => void };
    __cadencePreviewRpc?: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  }
}

const pending = new Map<string, Pending>();
let vscodeApi: { postMessage: (msg: unknown) => void } | null = null;

function api() {
  if (vscodeApi) return vscodeApi;
  if (typeof window.cadenceAcquireVsCodeApi === 'function') {
    vscodeApi = window.cadenceAcquireVsCodeApi();
    return vscodeApi;
  }
  try {
    const acq = (window as Window & { acquireVsCodeApi?: () => { postMessage: (msg: unknown) => void } }).acquireVsCodeApi;
    if (typeof acq === 'function') {
      vscodeApi = acq();
      return vscodeApi;
    }
  } catch {
    /* preview */
  }
  return null;
}

window.addEventListener('message', (event) => {
  const data = event.data as RpcResponse;
  if (!data || typeof data.id !== 'string') return;
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  if (data.ok) p.resolve(data.result);
  else p.reject(new Error(data.error || 'Request failed'));
});

let seq = 0;

export async function rpc<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (typeof window.__cadencePreviewRpc === 'function') {
    return (await window.__cadencePreviewRpc(method, params)) as T;
  }

  const id = `c-${Date.now()}-${++seq}`;
  const bridge = api();
  if (!bridge) throw new Error('Cadence RPC bridge unavailable');

  const result = new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (v) => resolve(v as T),
      reject,
    });
  });

  bridge.postMessage({ id, method, params } satisfies RpcRequest);
  return result;
}
