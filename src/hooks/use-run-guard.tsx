import { useEffect, useRef, useState } from 'react';
import { Callout } from '@radix-ui/themes';
import { toast } from 'sonner';
import type { ProviderProfile } from '../db/types';
import { ConfirmDialog } from '../components/confirm-dialog';
import { isDemoMode } from '../lib/onboarding';
import { checkRunLimits, DEMO_MAX_CALLS, DEMO_MAX_TASKS, DEMO_MAX_OUTPUT_TOKENS } from '../lib/run-limits';
import type { RunSize } from '../lib/run-limits';

export function useRunGuard(provider: ProviderProfile | null) {
  const demo = isDemoMode(provider);
  const locked = useRef(false);
  const resolver = useRef<((approved: boolean) => void) | null>(null);
  const [warning, setWarning] = useState('');

  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);

  function settle(approved: boolean) {
    const resolve = resolver.current;
    resolver.current = null;
    setWarning('');
    if (!approved && resolve) locked.current = false;
    resolve?.(approved);
  }

  async function approve(run: RunSize): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    const result = checkRunLimits(demo, run);
    if (result.blocked) {
      locked.current = false;
      toast.error(result.reasons.join(' '));
      return false;
    }
    if (result.reasons.length === 0) return true;
    setWarning(`${result.reasons.join(' ')} This run will make ${run.activeTaskCount * run.callCount} requests. Costs depend on the models, input, and output. Continue?`);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }

  return {
    demo,
    maxTasks: demo ? DEMO_MAX_TASKS : Infinity,
    maxCalls: demo ? DEMO_MAX_CALLS : 20,
    approve,
    finish: () => { locked.current = false; },
    ui: <>
      {demo && <Callout.Root size="1"><Callout.Text>
        Demo limits: 5 tasks, 2 calls per model, 64 KiB text/JSON and 5 MiB including images per request.
        Chat and extraction output is capped at {DEMO_MAX_OUTPUT_TOKENS.toLocaleString()} tokens per call.
      </Callout.Text></Callout.Root>}
      <ConfirmDialog open={Boolean(warning)} title="This run may be expensive"
        description={warning} confirmLabel="Run anyway"
        onConfirm={() => settle(true)} onOpenChange={(open) => { if (!open) settle(false); }} />
    </>,
  };
}
