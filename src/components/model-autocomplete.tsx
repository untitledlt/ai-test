import { useState } from 'react';
import { Anchor as PopoverAnchor } from '@radix-ui/react-popover';
import { Popover, TextField, Flex, Text, IconButton } from '@radix-ui/themes';
import { X } from 'lucide-react';
import { useAddCustomModel, useCustomModels, useDeleteCustomModel } from '../hooks/use-models';
import styles from './model-autocomplete.module.css';

type ModelAutoCompleteProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Overrides the suggestion source with a fixed list (e.g. models the active provider
   * actually supports for a given operation) instead of the user's custom-model history.
   * Typed values are not persisted as custom models when this is given.
   */
  suggestions?: string[];
  /** Optional display-only price label shown next to a suggestion, keyed by model value. */
  priceByValue?: Map<string, string>;
};

export function ModelAutoComplete({
  value,
  onChange,
  placeholder,
  disabled,
  suggestions,
  priceByValue,
}: ModelAutoCompleteProps) {
  const [open, setOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const customModelsQuery = useCustomModels();
  const addCustomModel = useAddCustomModel();
  const deleteCustomModel = useDeleteCustomModel();

  const usingFixedSuggestions = suggestions !== undefined;
  const allModels: Array<{ _id: string; _rev?: string; value: string }> = usingFixedSuggestions
    ? suggestions.map((modelValue) => ({ _id: modelValue, value: modelValue }))
    : (customModelsQuery.data ?? []);

  const query = filterQuery.toLowerCase();
  const matchingSuggestions = allModels.filter(
    (model) => query === '' || model.value.toLowerCase().includes(query),
  );

  function saveIfNew(candidate: string) {
    if (usingFixedSuggestions) return;
    const trimmed = candidate.trim();
    if (!trimmed) return;
    const alreadyKnown = allModels.some((model) => model.value === trimmed);
    if (alreadyKnown) return;
    addCustomModel.mutate(trimmed);
  }

  const showDropdown = !disabled && open && matchingSuggestions.length > 0;

  return (
    <Popover.Root open={showDropdown} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <TextField.Root
          value={value}
          placeholder={placeholder ?? 'Model'}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setFilterQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setFilterQuery('');
            setOpen(true);
          }}
          onClick={() => {
            setFilterQuery('');
            setOpen(true);
          }}
          onBlur={() => saveIfNew(value)}
        />
      </PopoverAnchor>
      <Popover.Content
        size="1"
        align="start"
        sideOffset={4}
        className={styles.dropdown}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <Flex direction="column" gap="1">
          {matchingSuggestions.map((model) => (
            <Flex
              key={model._id}
              align="center"
              justify="between"
              className={styles.option}
              onClick={() => {
                onChange(model.value);
                setOpen(false);
              }}
            >
              <Flex direction="column" gap="0">
                <Text as="p" size="2">
                  {model.value}
                </Text>
                {priceByValue?.has(model.value) && (
                  <Text as="p" size="1" color="gray">
                    {priceByValue.get(model.value)}
                  </Text>
                )}
              </Flex>
              {!usingFixedSuggestions && (
                <IconButton
                  size="1"
                  variant="ghost"
                  color="red"
                  aria-label={`Remove ${model.value}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteCustomModel.mutate(model);
                  }}
                >
                  <X size={14} />
                </IconButton>
              )}
            </Flex>
          ))}
        </Flex>
      </Popover.Content>
    </Popover.Root>
  );
}
