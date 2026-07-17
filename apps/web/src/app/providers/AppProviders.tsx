import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createApiClient, type SynaploomApiClient } from '#src/shared/api/client';

const ApiContext = createContext<SynaploomApiClient | null>(null);

/** Provides daemon transport and server-state cache to the React application. */
export function AppProviders({
  children,
  api = createApiClient(),
}: {
  readonly children: ReactNode;
  readonly api?: SynaploomApiClient;
}): ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 2_000, retry: false },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <ApiContext.Provider value={api}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}

/** Returns the configured local-daemon API client. */
export function useApi(): SynaploomApiClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error('Synaploom API provider is missing.');
  return api;
}
