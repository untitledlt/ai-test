import { RecordsList } from '../components/records-list';
import { useExtractRecords, useDeleteExtractRecord } from '../hooks/use-extract-records';

export function ExtractRecordsPage() {
  const recordsQuery = useExtractRecords();
  const deleteRecord = useDeleteExtractRecord();
  return (
    <RecordsList
      title="Extraction records"
      basePath="/extract"
      backLabel="Back to extraction"
      recordsQuery={recordsQuery}
      deleteRecord={deleteRecord}
    />
  );
}
