import { RecordsList } from '../components/records-list';
import { useRecords, useDeleteRecord } from '../hooks/use-records';

export function RecordsPage() {
  const recordsQuery = useRecords();
  const deleteRecord = useDeleteRecord();
  return (
    <RecordsList
      title="Records"
      basePath="/agent"
      backLabel="Back to editor"
      recordsQuery={recordsQuery}
      deleteRecord={deleteRecord}
    />
  );
}
