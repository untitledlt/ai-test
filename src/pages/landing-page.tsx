import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { FlaskConical, Image, ListChecks, MessagesSquare, Receipt, Settings } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useActiveProvider } from '../hooks/use-providers';
import { isOnboardingComplete } from '../lib/onboarding';
import { OnboardingDialog } from '../components/onboarding-dialog';
import { EXAMPLES, loadExample } from '../lib/examples';
import styles from './landing-page.module.css';

const tools = [
  {
    name: 'Chat & prompt testing',
    description: 'Build conversations and tool definitions. Compare responses across models and settings, track cost and latency, and check results with JavaScript tests.',
    path: '/agent',
    icon: MessagesSquare,
  },
  {
    name: 'Structured decisions',
    description: 'Ask yes/no, multiple-choice, or scoring questions about text and images. Compare structured answers and probabilities across repeated calls.',
    path: '/decision',
    icon: ListChecks,
  },
  {
    name: 'Image generation',
    description: 'Create images from a prompt and optional reference images. Explore models, aspect ratios, and resolutions, and compare results, cost, and timing.',
    path: '/image',
    icon: Image,
  },
  {
    name: 'Structured extraction',
    description: 'Turn receipts, forms, and other images into JSON. Define your instructions and schema, then compare extracted data across vision models.',
    path: '/extract',
    icon: Receipt,
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { activeProvider, isLoading } = useActiveProvider();
  const [loadError, setLoadError] = useState('');
  const [loadingExample, setLoadingExample] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<{ name: string; path: string } | null>(null);
  const ready = isOnboardingComplete(activeProvider);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Flex align="center" gap="2">
          <FlaskConical size={24} aria-hidden="true" />
          <Text size="4" weight="bold">AI Test</Text>
        </Flex>
        <Button asChild variant="soft" color="gray">
          <Link to="/settings"><Settings size={16} aria-hidden="true" /> Settings</Link>
        </Button>
      </header>
      <main>
        <div className={styles.intro}>
          <Heading as="h1" size={{ initial: '7', sm: '8' }}>
            What do you want to test?
          </Heading>
          <Text as="p" size="4" color="gray" className={styles.subtitle}>
            Explore prompts, compare models, and inspect the results. Choose a tool to get started.
          </Text>
        </div>
        {loadError && <Text as="p" color="red" role="alert">{loadError}</Text>}
        <div className={styles.grid}>
          {tools.map(({ name, description, path, icon: Icon }) => (
            <Card key={path} size="4" className={styles.card}>
              <div className={styles.icon}><Icon size={48} strokeWidth={1.5} aria-hidden="true" /></div>
              <Heading as="h2" size="5" id={`tool-${path.slice(1)}`}>{name}</Heading>
              <Text as="p" size="3" color="gray" className={styles.description}>{description}</Text>
              <Button asChild variant="soft" mt="3">
                <Link to={path} aria-labelledby={`tool-${path.slice(1)}`} aria-disabled={isLoading}
                  onClick={(event) => {
                    if (isLoading || !ready) { event.preventDefault(); if (!isLoading) setSelectedTool({ name, path }); }
                  }}>Open tool</Link>
              </Button>
              <Heading as="h3" size="3" mt="4">Examples</Heading>
              <Text as="p" size="1" color="gray" mt="1">Load and inspect locally. Choose a compatible model and submit to run; demo availability is unverified.</Text>
              <ul className={styles.examples}>
                {EXAMPLES.filter(example => example.tool === path).map(example => (
                  <li key={example.id}>
                    <Text as="p" size="2" weight="medium">{example.title}</Text>
                    <Text as="p" size="1" color="gray">{example.description} Requires: {example.capability}.</Text>
                    <Button size="1" variant="outline" mt="2" disabled={loadingExample !== null}
                      aria-label={`Load example: ${example.title}`}
                      onClick={async () => {
                        setLoadingExample(example.id); setLoadError('');
                        try { navigate(await loadExample(example)); }
                        catch { setLoadError('Could not load the example in this browser. Please try again.'); }
                        finally { setLoadingExample(null); }
                      }}>Load example</Button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </main>
      {selectedTool && <OnboardingDialog toolName={selectedTool.name}
        onCancel={() => setSelectedTool(null)}
        onComplete={() => { setSelectedTool(null); navigate(selectedTool.path); }} />}
    </div>
  );
}
