import { Flex, Button, DropdownMenu, IconButton, Text } from '@radix-ui/themes';
import {
  FlaskConical,
  FilePlus,
  FolderOpen,
  Home,
  Image,
  ListChecks,
  MessagesSquare,
  Receipt,
  Menu,
  Save,
  SaveAll,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './toolbar.module.css';

type ToolbarProps = {
  name: string;
  onNew: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  isSaving?: boolean;
  loadPath?: string;
};

export function Toolbar({ name, onNew, onSave, onSaveAs, isSaving, loadPath = '/agent/records' }: ToolbarProps) {
  const navigate = useNavigate();

  return (
    <Flex
      align="center"
      gap="4"
      px="4"
      py="2"
      style={{ borderBottom: '1px solid var(--gray-a4)', background: 'var(--color-panel-solid)' }}
    >
      <Flex align="center" gap="2" style={{ minWidth: 0 }}>
        <Flex
          align="center"
          justify="center"
          style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--radius-3)', background: 'var(--accent-9)', color: 'var(--accent-contrast)' }}
        >
          <FlaskConical size={21} aria-hidden="true" />
        </Flex>
        <Flex direction="column" style={{ minWidth: 0, maxWidth: 180 }}>
          <Text size="3" weight="bold" style={{ letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            AI Test
          </Text>
          <Text color="gray" title={name || 'Untitled'} style={{ fontSize: 10, lineHeight: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || 'Untitled'}
          </Text>
        </Flex>
      </Flex>
      <Flex align="center" gap="2" flexShrink="0" className={styles.desktopOnly}>
        <Button variant="ghost" className={styles.action} onClick={onNew}>
          <FilePlus size={16} /> New
        </Button>
        <Button variant="ghost" className={styles.action} onClick={() => navigate(loadPath)}>
          <FolderOpen size={16} /> Load
        </Button>
        <Button variant="ghost" className={styles.action} onClick={onSave} loading={isSaving}>
          <Save size={16} /> Save
        </Button>
        <Button variant="ghost" className={styles.action} onClick={onSaveAs}>
          <SaveAll size={16} /> Save as
        </Button>
      </Flex>

      <Flex flexGrow="1" />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton variant="soft" size="2" aria-label="Menu" className={styles.iconAction} style={{ flexShrink: 0 }}>
            <Menu size={20} aria-hidden="true" />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onSelect={() => navigate('/')}>
            <Home size={16} /> Home
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Label>Apps</DropdownMenu.Label>
          <DropdownMenu.Item onSelect={() => navigate('/agent')}>
            <MessagesSquare size={16} /> Chat &amp; prompt testing
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigate('/decision')}>
            <ListChecks size={16} /> Structured decisions
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigate('/image')}>
            <Image size={16} /> Image generation
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => navigate('/extract')}>
            <Receipt size={16} /> Structured extraction
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onSelect={() => navigate('/settings')}>
            <Settings size={16} /> Settings
          </DropdownMenu.Item>
          <DropdownMenu.Group className={styles.mobileOnly}>
            <DropdownMenu.Separator />
            <DropdownMenu.Label>Record</DropdownMenu.Label>
            <DropdownMenu.Item onSelect={onNew}>
              <FilePlus size={14} /> New
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => navigate(loadPath)}>
              <FolderOpen size={14} /> Load
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onSave} disabled={isSaving}>
              <Save size={14} /> Save
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onSaveAs}>
              <SaveAll size={14} /> Save as
            </DropdownMenu.Item>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  );
}
