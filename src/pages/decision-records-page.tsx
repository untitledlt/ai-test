import { RecordsList } from '../components/records-list';
import { useDecisionRecords, useDeleteDecisionRecord } from '../hooks/use-decision-records';

export function DecisionRecordsPage() {
  const recordsQuery = useDecisionRecords();
  const deleteRecord = useDeleteDecisionRecord();
  return (
    <RecordsList
      title="Decision records"
      basePath="/decision"
      backLabel="Back to decision"
      recordsQuery={recordsQuery}
      deleteRecord={deleteRecord}
    />
  );
}
