import { useState } from 'react';
import { Button, Box, Flex, Text, TextField, Card, IconButton, Checkbox, Select, Separator } from '@radix-ui/themes';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ToolDefinition, ToolPropertyType } from '../types';
import { randomUUID } from '../lib/uuid';
import styles from './tool-card.module.css';

const PROPERTY_TYPES: ToolPropertyType[] = ['string', 'number', 'integer', 'boolean', 'object', 'array'];

type PropertyDraft = {
  key: string;
  name: string;
  type: ToolPropertyType;
  description: string;
  required: boolean;
};

function toolToDraft(tool: ToolDefinition): { name: string; description: string; properties: PropertyDraft[] } {
  const requiredSet = new Set(tool.function.parameters?.required ?? []);
  const properties = Object.entries(tool.function.parameters?.properties ?? {}).map(([name, prop]) => ({
    key: randomUUID(),
    name,
    type: prop.type ?? 'string',
    description: prop.description ?? '',
    required: requiredSet.has(name),
  }));
  return { name: tool.function.name, description: tool.function.description ?? '', properties };
}

function draftToTool(name: string, description: string, properties: PropertyDraft[]): ToolDefinition {
  const namedProperties = properties.filter((property) => property.name.trim() !== '');
  const propertiesObject: Record<string, { type: ToolPropertyType; description?: string }> = Object.create(null);
  const required: string[] = [];

  for (const property of namedProperties) {
    const trimmedName = property.name.trim();
    propertiesObject[trimmedName] = {
      type: property.type,
      ...(property.description.trim() ? { description: property.description.trim() } : {}),
    };
    if (property.required) required.push(trimmedName);
  }

  return {
    type: 'function',
    function: {
      name: name.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      parameters: {
        type: 'object',
        properties: propertiesObject,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  };
}

type PropertyRowProps = {
  property: PropertyDraft;
  onChange: (property: PropertyDraft) => void;
  onRemove: () => void;
};

function PropertyRow({ property, onChange, onRemove }: PropertyRowProps) {
  return (
    <Box className={styles.propertyRow}>
      <TextField.Root
        size="1"
        className={styles.mono}
        value={property.name}
        onChange={(event) => onChange({ ...property, name: event.target.value })}
        placeholder="Property name"
      />
      <Select.Root
        size="1"
        value={property.type}
        onValueChange={(type) => onChange({ ...property, type: type as ToolPropertyType })}
      >
        <Select.Trigger aria-label="Property type" />
        <Select.Content>
          {PROPERTY_TYPES.map((type) => (
            <Select.Item key={type} value={type}>
              {type}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <TextField.Root
        size="1"
        value={property.description}
        onChange={(event) => onChange({ ...property, description: event.target.value })}
        placeholder="Property description"
      />
      <Text as="label" size="1" color="gray">
        <Flex gap="1" align="center">
          <Checkbox
            size="1"
            checked={property.required}
            onCheckedChange={(checked) => onChange({ ...property, required: checked === true })}
          />
          Required
        </Flex>
      </Text>
      <IconButton size="1" color="red" variant="soft" onClick={onRemove} aria-label="Remove property">
        <Trash2 size={14} />
      </IconButton>
    </Box>
  );
}

type ToolCardProps = {
  tool: ToolDefinition;
  defaultExpanded?: boolean;
  onChange: (tool: ToolDefinition) => void;
  onRemove: () => void;
};

export function ToolCard({ tool, defaultExpanded = false, onChange, onRemove }: ToolCardProps) {
  const initialDraft = toolToDraft(tool);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [name, setName] = useState(initialDraft.name);
  const [description, setDescription] = useState(initialDraft.description);
  const [properties, setProperties] = useState<PropertyDraft[]>(initialDraft.properties);

  function commit(nextName: string, nextDescription: string, nextProperties: PropertyDraft[]) {
    onChange(draftToTool(nextName, nextDescription, nextProperties));
  }

  function handleNameChange(value: string) {
    setName(value);
    commit(value, description, properties);
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    commit(name, value, properties);
  }

  function handleAddProperty() {
    const next = [
      ...properties,
      { key: randomUUID(), name: '', type: 'string' as ToolPropertyType, description: '', required: false },
    ];
    setProperties(next);
    commit(name, description, next);
  }

  function updateProperty(index: number, nextProperty: PropertyDraft) {
    const next = properties.map((property, i) => (i === index ? nextProperty : property));
    setProperties(next);
    commit(name, description, next);
  }

  function removeProperty(index: number) {
    const next = properties.filter((_, i) => i !== index);
    setProperties(next);
    commit(name, description, next);
  }

  const params = properties
    .filter((property) => property.name.trim() !== '')
    .map((property) => `${property.name.trim()}${property.required ? '' : '?'}: ${property.type}`)
    .join(', ');

  return (
    <Card size="1">
      <Flex justify="between" align="center" gap="2">
        <Flex
          align="center"
          gap="1"
          style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Flex align="baseline" gap="2" className={styles.summary}>
            <Text size="2" weight="medium" className={styles.mono}>
              {name || 'Untitled tool'}
            </Text>
            <Text size="1" color="gray" className={styles.mono}>
              {`(${params})`}
            </Text>
            {description && (
              <Text size="1" color="gray" className={styles.description}>
                {description}
              </Text>
            )}
          </Flex>
        </Flex>
        <IconButton size="1" color="red" variant="soft" onClick={onRemove} aria-label={`Remove ${name || 'tool'}`}>
          <Trash2 size={14} />
        </IconButton>
      </Flex>

      {expanded && (
        <Flex direction="column" gap="3" mt="3" pl="2">
          <Box className={styles.fields}>
            <Text as="label" size="1" color="gray">
              Name
              <TextField.Root
                size="1"
                className={styles.mono}
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                placeholder="get_weather"
              />
            </Text>
            <Text as="label" size="1" color="gray">
              Description
              <TextField.Root
                size="1"
                value={description}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                placeholder="What this tool does"
              />
            </Text>
          </Box>

          <Separator size="4" />

          <Flex justify="between" align="center">
            <Text size="1" weight="medium" color="gray">
              Properties
            </Text>
            <Button variant="soft" size="1" onClick={handleAddProperty}>
              <Plus size={12} /> Add property
            </Button>
          </Flex>

          {properties.length > 0 && (
            <Flex direction="column" gap="1">
              {properties.map((property, index) => (
                <PropertyRow
                  key={property.key}
                  property={property}
                  onChange={(next) => updateProperty(index, next)}
                  onRemove={() => removeProperty(index)}
                />
              ))}
            </Flex>
          )}
        </Flex>
      )}
    </Card>
  );
}
