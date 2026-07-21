import { describe, expect, it } from 'vitest';
import { createDevServerOptions } from '../../apps/web/vite.config';

describe('createDevServerOptions', () => {
  it('proxies API and bootstrap requests to the configured Go origin', () => {
    const server = createDevServerOptions('http://127.0.0.1:4317');
    const proxy = server?.proxy;

    expect(proxy?.['/api']).toMatchObject({
      target: 'http://127.0.0.1:4317',
      changeOrigin: false,
    });
    expect(proxy?.['/bootstrap']).toMatchObject({
      target: 'http://127.0.0.1:4317',
      changeOrigin: false,
    });
  });

  it('uses the local development origin by default', () => {
    const proxy = createDevServerOptions()?.proxy;
    expect(proxy?.['/api']).toMatchObject({ target: 'http://127.0.0.1:4174' });
  });
});
