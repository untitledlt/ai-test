import type { ReactNode } from 'react';
import { Theme } from '@radix-ui/themes';
import { Toaster } from 'sonner';
import { UI_THEME } from './theme-tokens';

type AppThemeProps = {
  children: ReactNode;
  appearance?: 'light' | 'dark' | 'inherit';
};

/** Radix `<Theme>` with the kit's brand values, plus the toast host (sonner, top-right). */
export function AppTheme({ children, appearance = 'inherit' }: AppThemeProps) {
  return (
    <Theme {...UI_THEME} appearance={appearance}>
      {children}
      <Toaster richColors position="top-right" />
    </Theme>
  );
}
