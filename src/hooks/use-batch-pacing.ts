import { useState } from 'react';

export type BatchPacing = { concurrency: number; startIntervalMs: number };

export function useBatchPacing(demo: boolean) {
  const [settings, setSettings] = useState({
    demo: { concurrency: 1, startIntervalMs: 1000 },
    personal: { concurrency: 5, startIntervalMs: 0 },
  });
  const mode = demo ? 'demo' : 'personal';
  return {
    value: settings[mode],
    onChange: (value: BatchPacing) => setSettings((previous) => ({ ...previous, [mode]: value })),
  };
}
