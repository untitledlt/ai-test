import { useState } from 'react';
import { Table, TextField, IconButton, Text } from '@radix-ui/themes';
import { Trash2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDateTime } from '../lib/format';
import { PageLayout } from './page-layout';
import { ConfirmDialog } from './confirm-dialog';

type ListedRecord = { _id: string; name: string; updatedAt: string };

type RecordsListProps<T extends ListedRecord> = {
  title: string;
  basePath: string;
  backLabel: string;
  recordsQuery: { data?: T[]; isLoading: boolean };
  deleteRecord: {
    mutate: (record: T, options: { onSuccess: () => void; onError: (error: Error) => void }) => void;
  };
};

export function RecordsList<T extends ListedRecord>({
  title, basePath, backLabel, recordsQuery, deleteRecord,
}: RecordsListProps<T>) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deletingRecord, setDeletingRecord] = useState<T | null>(null);

  const records = (recordsQuery.data ?? []).filter((record) =>
    record.name.toLowerCase().includes(search.toLowerCase()),
  );

  function handleDelete() {
    if (!deletingRecord) return;
    deleteRecord.mutate(deletingRecord, {
      onSuccess: () => toast.success('Record deleted'),
      onError: (err) => toast.error(err.message),
    });
    setDeletingRecord(null);
  }

  return (
    <PageLayout title={title} backPath={basePath} backLabel={backLabel}>
      <TextField.Root
        mb="4"
        placeholder="Search records by name..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      >
        <TextField.Slot>
          <Search size={16} />
        </TextField.Slot>
      </TextField.Root>

      <Table.Root variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Updated</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell aria-label="Actions" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {records.map((record) => (
            <Table.Row
              key={record._id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`${basePath}/${record._id}`)}
            >
              <Table.Cell>{record.name}</Table.Cell>
              <Table.Cell>{formatDateTime(record.updatedAt)}</Table.Cell>
              <Table.Cell>
                <IconButton
                  variant="ghost"
                  color="red"
                  aria-label="Delete record"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeletingRecord(record);
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Table.Cell>
            </Table.Row>
          ))}
          {records.length === 0 && !recordsQuery.isLoading && (
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Text color="gray">No records found.</Text>
              </Table.Cell>
            </Table.Row>
          )}
          {recordsQuery.isLoading && (
            <Table.Row>
              <Table.Cell colSpan={3}>
                <Text color="gray">Loading...</Text>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>

      <ConfirmDialog
        open={deletingRecord != null}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
        title="Delete record"
        description={<>Delete "{deletingRecord?.name}"? This cannot be undone.</>}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </PageLayout>
  );
}
