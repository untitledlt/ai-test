import { Navigate, useParams } from 'react-router-dom';

export function LegacyMultipleRedirect() {
  const { promptId } = useParams<{ promptId: string }>();
  return <Navigate to={`/agent/${promptId}?tab=multiple`} replace />;
}
