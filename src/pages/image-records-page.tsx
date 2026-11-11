import { RecordsList } from '../components/records-list';
import { useImageGenRecords, useDeleteImageGenRecord } from '../hooks/use-image-gen-records';

export function ImageRecordsPage() {
  const recordsQuery = useImageGenRecords();
  const deleteRecord = useDeleteImageGenRecord();
  return (
    <RecordsList
      title="Image generation records"
      basePath="/image"
      backLabel="Back to image generation"
      recordsQuery={recordsQuery}
      deleteRecord={deleteRecord}
    />
  );
}
