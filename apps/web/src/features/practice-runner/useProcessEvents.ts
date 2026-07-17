import type { ProcessEvent } from '@synaploom/contracts';
import { useEffect, useState } from 'react';
import { openProcessEvents } from '#src/shared/api/client';

const OUTPUT_LIMIT = 1_000_000;
const INITIAL_OUTPUT_STATE: ProcessOutputState = {
  output: '',
  terminal: false,
  disconnected: false,
};

/** Accumulated terminal state for one declared action. */
export interface ProcessOutputState {
  readonly output: string;
  readonly terminal: boolean;
  readonly disconnected: boolean;
}

interface ProcessSessionState {
  readonly eventsUrl: string | null;
  readonly output: ProcessOutputState;
}

/** Subscribes to daemon process events while bounding browser memory use. */
export function useProcessEvents(eventsUrl: string | null): ProcessOutputState {
  const [session, setSession] = useState<ProcessSessionState>({
    eventsUrl: null,
    output: INITIAL_OUTPUT_STATE,
  });

  useEffect(() => {
    if (!eventsUrl) return undefined;

    return openProcessEvents(
      eventsUrl,
      (event: ProcessEvent) => {
        setSession((current) => {
          const output = current.eventsUrl === eventsUrl ? current.output : INITIAL_OUTPUT_STATE;
          if (event.type === 'process.stdout' || event.type === 'process.stderr') {
            return {
              eventsUrl,
              output: {
                ...output,
                output: `${output.output}${event.chunk}`.slice(-OUTPUT_LIMIT),
              },
            };
          }
          if (
            event.type === 'process.exited' ||
            event.type === 'process.timed_out' ||
            event.type === 'process.killed'
          ) {
            return { eventsUrl, output: { ...output, terminal: true } };
          }
          return { eventsUrl, output };
        });
      },
      () => {
        setSession((current) => ({
          eventsUrl,
          output: {
            ...(current.eventsUrl === eventsUrl ? current.output : INITIAL_OUTPUT_STATE),
            disconnected: true,
          },
        }));
      },
    );
  }, [eventsUrl]);

  if (!eventsUrl || session.eventsUrl !== eventsUrl) return INITIAL_OUTPUT_STATE;
  return session.output;
}
