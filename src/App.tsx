import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/dashboard/Dashboard';
import { SearchVisibility } from './pages/SearchVisibility';
import { AISources } from './pages/AISources';
import { SearchSourcesR2 } from './pages/SearchSourcesR2';
import { Topics } from './pages/Topics';
import { Prompts } from './pages/Prompts';
import { Keywords } from './pages/Keywords';
import { SentimentLandscape2 } from './pages/SentimentLandscape2';
import { RecommendationsV3 } from './pages/RecommendationsV3';
import { Setup } from './pages/Setup';
import { Onboarding } from './pages/Onboarding';
import { OnboardingJSONPage } from './pages/OnboardingJSONPage';
import { PromptSelection } from './pages/PromptSelection';
import { DataCollectionLoadingScreenRoute } from './components/Onboarding/DataCollectionLoadingScreen';
import { OnboardingDomainReadinessScreenRoute } from './components/Onboarding/OnboardingDomainReadinessScreen';
import { ManageCompetitors } from './pages/ManageCompetitors';
import { ManageBrands } from './pages/ManageBrands';
import { ManageCollectors } from './pages/ManageCollectors';
import { GoogleAnalytics } from './pages/GoogleAnalytics';
import { TopicsPromptsConfigV2 } from './pages/TopicsPromptsConfigV2';
import MoversAndShakers from './pages/MoversAndShakers';
import { ScheduledJobs } from './pages/admin/ScheduledJobs';
import { DataCollectionStatus } from './pages/admin/DataCollectionStatus';
import { CustomerEntitlements } from './pages/admin/CustomerEntitlements';
import { CollectionStats } from './pages/admin/CollectionStats';
import { OperationsDashboard } from './pages/admin/OperationsDashboard';
import { DomainReadinessPage } from './pages/DomainReadiness/DomainReadinessPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { EntitlementRoute } from './components/EntitlementRoute';
import { AdminRoute } from './components/AdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { featureFlags } from './config/featureFlags';
import { onboardingUtils } from './utils/onboardingUtils';
import LandingPage from './pages/LandingPage';
import { ExecutiveReportingPage } from './pages/ExecutiveReporting/ExecutiveReportingPage';
import { QueriesAnalysisPage } from './pages/QueriesAnalysis/QueriesAnalysisPage';
import { ManageReports } from './pages/ManageReports';
import { ExecutiveSummaryPage } from './pages/executive-summary/ExecutiveSummaryPage';


// New pages for restructured navigation
import { MeasurePage } from './pages/Measure';
import { DiscoverPage, ActionPlanPage, ExecutePage, ImpactPage } from './pages/Improve';
import { OpportunitiesQBRES } from './features/opportunity-identifier/OpportunitiesPage';


function DefaultRedirect() {
  if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
    return <Navigate to="/measure" replace />;
  }

  if (featureFlags.skipOnboardingAfterLogin) {
    // Skip onboarding, go to setup
    return onboardingUtils.isOnboardingComplete() ? (
      <Navigate to="/measure" replace />
    ) : (
      <Navigate to="/setup" replace />
    );
  }

  if (featureFlags.forceOnboardingAfterLogin) {
    return <Navigate to="/onboarding" replace />;
  }

  // Check onboarding completion (brand/competitors)
  if (typeof window !== 'undefined' && localStorage.getItem('onboarding_complete') === 'true') {
    // Onboarding complete, check setup
    return onboardingUtils.isOnboardingComplete() ? (
      <Navigate to="/measure" replace />
    ) : (
      <Navigate to="/setup" replace />
    );
  }

  // Onboarding not complete, go to onboarding
  return <Navigate to="/onboarding" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <Setup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/loading/:brandId"
          element={
            <ProtectedRoute>
              <DataCollectionLoadingScreenRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding/domain-readiness/:brandId"
          element={
            <ProtectedRoute>
              <OnboardingDomainReadinessScreenRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="/movers-shakers"
          element={
            <ProtectedRoute>
              <MoversAndShakers />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* MEASURE SECTION        */}
        {/* ====================== */}
        <Route
          path="/measure"
          element={
            <EntitlementRoute requiredFeature="measure" fallbackPath="/settings/manage-brands">
              <MeasurePage />
            </EntitlementRoute>
          }
        />
        {/* Redirect old /dashboard to /measure */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Navigate to="/measure" replace />
            </ProtectedRoute>
          }
        />
        {/* Redirect old /search-visibility to /measure */}
        <Route
          path="/search-visibility"
          element={
            <ProtectedRoute>
              <Navigate to="/measure" replace />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* ANALYZE SECTION        */}
        {/* ====================== */}
        <Route
          path="/analyze/citation-sources"
          element={
            <EntitlementRoute requiredFeature="analyze_citation_sources">
              <SearchSourcesR2 />
            </EntitlementRoute>
          }
        />
        <Route
          path="/analyze/topics"
          element={
            <EntitlementRoute requiredFeature="analyze_topics">
              <Topics />
            </EntitlementRoute>
          }
        />
        <Route
          path="/analyze/queries"
          element={
            <EntitlementRoute requiredFeature="analyze_queries">
              <QueriesAnalysisPage />
            </EntitlementRoute>
          }
        />
        <Route
          path="/analyze/queries-answers"
          element={
            <EntitlementRoute requiredFeature="analyze_answers">
              <Prompts />
            </EntitlementRoute>
          }
        />
        <Route
          path="/analyze/keywords"
          element={
            <EntitlementRoute requiredFeature="analyze_keywords">
              <Keywords />
            </EntitlementRoute>
          }
        />
        <Route
          path="/analyze/keywords-graph"
          element={
            <EntitlementRoute requiredFeature="analyze_keywords">
              <SentimentLandscape2 />
            </EntitlementRoute>
          }
        />
        <Route
          path="/analyze/domain-readiness"
          element={
            <EntitlementRoute requiredFeature="analyze_domain_readiness">
              <DomainReadinessPage />
            </EntitlementRoute>
          }
        />
        {/* Redirects from old Analyze routes */}
        <Route
          path="/search-sources"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/citation-sources" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search-sources-r2"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/citation-sources" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/topics"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/topics" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/queries" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/keywords"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/keywords" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/domain-readiness"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/domain-readiness" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-sources"
          element={
            <ProtectedRoute>
              <Navigate to="/analyze/citation-sources" replace />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* IMPROVE SECTION        */}
        {/* ====================== */}
        <Route
          path="/improve/discover"
          element={
            <EntitlementRoute requiredFeature="recommendations">
              <DiscoverPage />
            </EntitlementRoute>
          }
        />
        <Route
          path="/improve/action-plan"
          element={
            <EntitlementRoute requiredFeature="recommendations">
              <ActionPlanPage />
            </EntitlementRoute>
          }
        />
        <Route
          path="/improve/execute"
          element={
            <EntitlementRoute requiredFeature="recommendations">
              <ExecutePage />
            </EntitlementRoute>
          }
        />
        <Route
          path="/improve/impact"
          element={
            <EntitlementRoute requiredFeature="recommendations">
              <ImpactPage />
            </EntitlementRoute>
          }
        />
        <Route
          path="/improve/opportunities/qbrs"
          element={
            <EntitlementRoute requiredFeature="recommendations">
              <OpportunitiesQBRES />
            </EntitlementRoute>
          }
        />
        {/* Redirects from old Recommendations routes */}
        <Route
          path="/recommendations"
          element={
            <ProtectedRoute>
              <Navigate to="/improve/discover" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations-v3"
          element={
            <ProtectedRoute>
              <Navigate to="/improve/discover" replace />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* EXECUTIVE REPORTING    */}
        {/* ====================== */}
        <Route
          path="/executive-reporting"
          element={
            <EntitlementRoute requiredFeature="executive_reporting">
              <ExecutiveReportingPage />
            </EntitlementRoute>
          }
        />
        <Route
          path="/executive-summary"
          element={
            <ProtectedRoute>
              <ExecutiveSummaryPage />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* SETTINGS SECTION       */}
        {/* ====================== */}
        <Route
          path="/prompt-selection"
          element={
            <ProtectedRoute>
              <PromptSelection />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Navigate to="/settings/manage-brands" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/topics-prompts-config-v2"
          element={
            <ProtectedRoute>
              <TopicsPromptsConfigV2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/manage-competitors"
          element={
            <ProtectedRoute>
              <ManageCompetitors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/manage-brands"
          element={
            <ProtectedRoute>
              <ManageBrands />
            </ProtectedRoute>
          }
        />
        <Route
          path="/google-analytics"
          element={
            <ProtectedRoute>
              <GoogleAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/manage-collectors"
          element={
            <ProtectedRoute>
              <ManageCollectors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/manage-reports"
          element={
            <ProtectedRoute>
              <ManageReports />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* ADMIN ROUTES           */}
        {/* ====================== */}
        <Route element={<AdminLayout />}>
          <Route path="/admin/scheduled-jobs" element={<ScheduledJobs />} />
          <Route path="/admin/scheduled-tasks" element={<ScheduledJobs />} />
          <Route path="/admin/data-collection-status" element={<DataCollectionStatus />} />
          <Route path="/admin/collection-stats" element={<CollectionStats />} />
          <Route path="/admin/entitlements" element={<CustomerEntitlements />} />
          <Route path="/admin/operations" element={<OperationsDashboard />} />
        </Route>
        <Route
          path="/admin/Data_Collection_Status"
          element={
            <ProtectedRoute>
              <Navigate to="/admin/data-collection-status" replace />
            </ProtectedRoute>
          }
        />

        {/* ====================== */}
        {/* ROOT ROUTES            */}
        {/* ====================== */}
        <Route
          path="/"
          element={<LandingPage />}
        />
        <Route
          path="/app"
          element={<DefaultRedirect />}
        />
        {/* New JSON Onboarding Route */}
        <Route
          path="/onboarding-json"
          element={
            <ProtectedRoute>
              <OnboardingJSONPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
