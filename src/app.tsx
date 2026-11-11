import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AppTheme } from '@untitled/ui-kit';
import { getOrCreateAppSettings } from './hooks/use-providers';
import { ensureSyncMatchesSettings } from './hooks/use-sync-settings';
import { seedExamples } from './lib/examples';
import { seedInitialData } from './lib/seed-data';

const queryClient = new QueryClient();

export function App() {
  useEffect(() => {
    seedInitialData()
      .then(seedExamples)
      .then(getOrCreateAppSettings)
      .then(ensureSyncMatchesSettings)
      .then(() => queryClient.invalidateQueries())
      .catch(() => {
        // Seeding/sync are best-effort; startup failures are surfaced only when the user interacts with settings.
      });
  }, []);

  return (
    <AppTheme>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AppTheme>
  );
}
