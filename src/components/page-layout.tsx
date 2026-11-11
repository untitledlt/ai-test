import type { ReactNode } from 'react';
import { Box, Flex, Heading, IconButton } from '@radix-ui/themes';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type PageLayoutProps = {
  title: string;
  backPath: string;
  backLabel: string;
  children: ReactNode;
};

export function PageLayout({ title, backPath, backLabel, children }: PageLayoutProps) {
  const navigate = useNavigate();
  return (
    <Box p="5" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Flex align="center" gap="3" mb="5">
        <IconButton variant="soft" onClick={() => navigate(backPath)} aria-label={backLabel}>
          <ArrowLeft size={16} />
        </IconButton>
        <Heading>{title}</Heading>
      </Flex>
      {children}
    </Box>
  );
}
