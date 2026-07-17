import type { AiProvider, AiRequest, AiResponse } from '#src/index';

/** Default provider that keeps AI optional and offline course playback complete. */
export class DisabledAiProvider implements AiProvider {
  readonly id = 'disabled';

  async generate(request: AiRequest, signal: AbortSignal): Promise<AiResponse> {
    void request;
    void signal;
    return Promise.resolve({
      status: 'disabled',
      message: 'AI assistance is not configured.',
    });
  }
}
