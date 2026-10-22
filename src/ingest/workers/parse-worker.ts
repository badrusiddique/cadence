import { ingestAll } from '../index';

process.on('message', (msg: { demoMode?: boolean }) => {
  try {
    const result = ingestAll({
      demoMode: Boolean(msg?.demoMode),
      onProgress: (update) => process.send?.({ type: 'progress', update }),
    });
    process.send?.({
      type: 'result',
      payload: {
        sessions: result.sessions,
        workspaces: [...result.workspaces.entries()],
        sources: result.sources,
        errors: result.errors,
      },
    });
  } catch (err) {
    process.send?.({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
