import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/dashboard/Dashboard';
import { SearchVisibility } from './pages/SearchVisibility';
import { AISources } from './pages/AISources';
import { SearchSourcesR2 } from './pages/SearchSourcesR2';
import { Topics } from './pages/Topics';
import { Prompts } from './pages/Prompts';
import { Keywords } from './pages/Keywords';
import { Recommendations } from './pages/Recommendations';
import { RecommendationsV2 } from './pages/RecommendationsV2';
import { RecommendationsV3 } from './pages/RecommendationsV3';
import { Setup } from './pages/Setup';
import { Onboarding } from './pages/Onboarding';
import { PromptSelection } from './pages/PromptSelection';
import { DataCollectionLoadingScreenRoute } from './components/Onboarding/DataCollectionLoadingScreen';
import { Settings } from './pages/Settings';
import { ManagePrompts } from './pages/ManagePrompts';
import { ManageCompetitors } from './pages/ManageCompetitors';
import { ManageBrands } from './pages/ManageBrands';
import { TopicsPromptsConfigV2 } from './pages/TopicsPromptsConfigV2/index';
import { ScheduledJobs } from './pages/admin/ScheduledJobs';
import { DataCollectionStatus } from './pages/admin/DataCollectionStatus';
import { ProtectedRoute } from './components/ProtectedRoute';
import { featureFlags } from './config/featureFlags';
import { onboardingUtils } from './utils/onboardingUtils';

function DefaultRedirect() {
  if (featureFlags.skipSetupCheck || featureFlags.skipOnboardingCheck) {
    return <Navigate to="/dashboard" replace />;
  }
  
  if (featureFlags.skipOnboardingAfterLogin) {
    // Skip onboarding, go to setup
    return onboardingUtils.isOnboardingComplete() ? (
      <Navigate to="/dashboard" replace />
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
      <Navigate to="/dashboard" replace />
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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search-visibility"
          element={
            <ProtectedRoute>
              <SearchVisibility />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-sources"
          element={
            <ProtectedRoute>
              <AISources />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search-sources"
          element={
            <ProtectedRoute>
              <SearchSourcesR2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search-sources-r2"
          element={
            <ProtectedRoute>
              <Navigate to="/search-sources" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/topics"
          element={
            <ProtectedRoute>
              <Topics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <Prompts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/keywords"
          element={
            <ProtectedRoute>
              <Keywords />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations"
          element={
            <ProtectedRoute>
              <RecommendationsV2 />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations-v2"
          element={
            <ProtectedRoute>
              <Navigate to="/recommendations" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations-v1"
          element={
            <ProtectedRoute>
              <Recommendations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recommendations-v3"
          element={
            <ProtectedRoute>
              <RecommendationsV3 />
            </ProtectedRoute>
          }
        />
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
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/manage-prompts"
          element={
            <ProtectedRoute>
              <ManagePrompts />
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
          path="/settings/manage-topics"
          element={
            <ProtectedRoute>
              <Navigate to="/settings/manage-prompts" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/scheduled-jobs"
          element={
            <ProtectedRoute>
              <ScheduledJobs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/data-collection-status"
          element={
            <ProtectedRoute>
              <DataCollectionStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/Data_Collection_Status"
          element={
            <ProtectedRoute>
              <Navigate to="/admin/data-collection-status" replace />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/" 
          element={<DefaultRedirect />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
