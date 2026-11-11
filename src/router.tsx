import { createBrowserRouter } from 'react-router-dom';
import { LandingPage } from './pages/landing-page';
import { RecordPage } from './pages/record-page';
import { RecordsPage } from './pages/records-page';
import { SettingsPage } from './pages/settings-page';
import { LegacyMultipleRedirect } from './pages/legacy-multiple-redirect';
import { DecisionPage } from './pages/decision-page';
import { DecisionRecordsPage } from './pages/decision-records-page';
import { ImagePage } from './pages/image-page';
import { ImageRecordsPage } from './pages/image-records-page';
import { ExtractPage } from './pages/extract-page';
import { ExtractRecordsPage } from './pages/extract-records-page';

export const router = createBrowserRouter(
  [
    { path: '/', element: <LandingPage /> },
    { path: '/agent', element: <RecordPage /> },
    { path: '/agent/records', element: <RecordsPage /> },
    { path: '/settings', element: <SettingsPage /> },
    { path: '/decision', element: <DecisionPage /> },
    { path: '/decision/records', element: <DecisionRecordsPage /> },
    { path: '/decision/:decisionId', element: <DecisionPage /> },
    { path: '/image', element: <ImagePage /> },
    { path: '/image/records', element: <ImageRecordsPage /> },
    { path: '/image/:imageId', element: <ImagePage /> },
    { path: '/extract', element: <ExtractPage /> },
    { path: '/extract/records', element: <ExtractRecordsPage /> },
    { path: '/extract/:extractId', element: <ExtractPage /> },
    { path: '/agent/:recordId', element: <RecordPage /> },
    { path: '/:promptId/multiple', element: <LegacyMultipleRedirect /> },
  ],
  { basename: import.meta.env.BASE_URL },
);
