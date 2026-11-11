import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

// A data router (RouterProvider + createMemoryRouter), not plain MemoryRouter, because
// useBlocker (used by record-page.tsx and decision-page.tsx) throws "must be used within a
// data router" otherwise. `path` lets a test declare route params (e.g. ':decisionId') that
// `route` should match; it defaults to a catch-all for tests that don't need params.
export function renderWithProviders(ui: ReactElement, options?: { route?: string; path?: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: options?.path ?? '*', element: ui }], {
    initialEntries: [options?.route ?? '/'],
  });
  return render(
    <Theme>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Theme>,
  );
}
