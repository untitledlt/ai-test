import { Callout } from '@radix-ui/themes';
import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ProviderWarning({ inSettings = false }: { inSettings?: boolean }) {
  return (
    <Callout.Root color="amber" mb={inSettings ? '6' : undefined}>
      <Callout.Icon><TriangleAlert size={16} /></Callout.Icon>
      <Callout.Text>
        {inSettings ? 'Configure an active provider with an API key before submitting.' : (
          <>Configure a provider in Settings before submitting. <Link to="/settings">Go to Settings</Link></>
        )}
      </Callout.Text>
    </Callout.Root>
  );
}
