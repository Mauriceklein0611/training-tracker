import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import HomePage from '@/pages/HomePage';

/*
 * Only the home screen is part of the initial bundle. Everything else is split
 * out so the first paint on a phone stays fast; the service worker precaches
 * the chunks anyway, so navigation works offline right after the first visit.
 */
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const TemplateEditPage = lazy(() => import('@/pages/TemplateEditPage'));
const HistoryPage = lazy(() => import('@/pages/HistoryPage'));
const SessionDetailPage = lazy(() => import('@/pages/SessionDetailPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const BlockComparePage = lazy(() => import('@/pages/BlockComparePage'));
const PlanComparePage = lazy(() => import('@/pages/PlanComparePage'));
const WorkoutUnitComparePage = lazy(() => import('@/pages/WorkoutUnitComparePage'));
const MorePage = lazy(() => import('@/pages/MorePage'));
const WorkoutUnitsPage = lazy(() => import('@/pages/WorkoutUnitsPage'));
const WorkoutUnitEditPage = lazy(() => import('@/pages/WorkoutUnitEditPage'));
const ExercisesPage = lazy(() => import('@/pages/ExercisesPage'));
const EquipmentProfilesPage = lazy(() => import('@/pages/EquipmentProfilesPage'));
const BodyWeightPage = lazy(() => import('@/pages/BodyWeightPage'));
const DataPage = lazy(() => import('@/pages/DataPage'));
const AiAnalysesPage = lazy(() => import('@/pages/AiAnalysesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const StoragePage = lazy(() => import('@/pages/StoragePage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const LiveSessionPage = lazy(() => import('@/pages/LiveSessionPage'));

function PageFallback() {
  return (
    <p className="p-6 text-center text-sm text-muted" role="status">
      Wird geladen …
    </p>
  );
}

export default function App() {
  const { settings } = useSettings();
  useTheme(settings.darkMode);

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/plaene" element={<TemplatesPage />} />
          <Route path="/plaene/:planId" element={<TemplateEditPage />} />
          <Route path="/bibliothek" element={<WorkoutUnitsPage />} />
          <Route path="/bibliothek/:unitId" element={<WorkoutUnitEditPage />} />
          <Route path="/verlauf" element={<HistoryPage />} />
          <Route path="/verlauf/:sessionId" element={<SessionDetailPage />} />
          <Route path="/analyse" element={<AnalyticsPage />} />
          <Route path="/analyse/vergleich" element={<BlockComparePage />} />
          <Route path="/analyse/plaene-vergleich" element={<PlanComparePage />} />
          <Route
            path="/analyse/einheiten-vergleich"
            element={<WorkoutUnitComparePage />}
          />
          <Route path="/mehr" element={<MorePage />} />
          <Route path="/mehr/uebungen" element={<ExercisesPage />} />
          <Route path="/mehr/equipment" element={<EquipmentProfilesPage />} />
          <Route path="/mehr/koerpergewicht" element={<BodyWeightPage />} />
          <Route path="/mehr/daten" element={<DataPage />} />
          <Route path="/mehr/ki-analysen" element={<AiAnalysesPage />} />
          <Route path="/mehr/einstellungen" element={<SettingsPage />} />
          <Route path="/mehr/speicher" element={<StoragePage />} />
          <Route path="/mehr/datenschutz" element={<PrivacyPage />} />
          <Route path="/training/:sessionId" element={<LiveSessionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
