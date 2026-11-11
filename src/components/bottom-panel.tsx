import { useState } from 'react';
import { Tabs, Box, Flex, Button, Text } from '@radix-ui/themes';
import { Play } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { DockPanel } from '@untitled/ui-kit';
import styles from './bottom-panel.module.css';

type BottomPanelProps = {
  height: number;
  onStartResize: (event: React.PointerEvent) => void;
  testSuite: string;
  onTestSuiteChange: (value: string) => void;
  rawResponseText: string;
  onRunTests: () => void;
  isRunningTests: boolean;
};

export function BottomPanel({
  height,
  onStartResize,
  testSuite,
  onTestSuiteChange,
  rawResponseText,
  onRunTests,
  isRunningTests,
}: BottomPanelProps) {
  const [tab, setTab] = useState<'suite' | 'raw'>('suite');

  return (
    <DockPanel height={height} onStartResize={onStartResize}>
      <Tabs.Root className={styles.tabsRoot} value={tab} onValueChange={(value) => setTab(value as 'suite' | 'raw')}>
        <Flex justify="between" align="center" pr="3">
          <Tabs.List>
            <Tabs.Trigger value="suite">Test suite</Tabs.Trigger>
            <Tabs.Trigger value="raw">Raw response</Tabs.Trigger>
          </Tabs.List>
          {tab === 'suite' && (
            <Button size="1" onClick={onRunTests} loading={isRunningTests}>
              <Play size={14} /> Run tests
            </Button>
          )}
        </Flex>
        {tab === 'suite' && (
          <Text as="p" size="1" color="amber" mx="3" my="2">
            Run only code you trust. Test suites can access saved data, including API keys, and make network requests.
          </Text>
        )}
        <Box className={styles.editorArea}>
          {tab === 'suite' ? (
            <CodeMirror value={testSuite} height="100%" extensions={[javascript()]} onChange={onTestSuiteChange} style={{ fontSize: 12 }} />
          ) : (
            <CodeMirror
              value={rawResponseText}
              height="100%"
              extensions={[json()]}
              editable={false}
              style={{ fontSize: 13 }}
            />
          )}
        </Box>
      </Tabs.Root>
    </DockPanel>
  );
}
