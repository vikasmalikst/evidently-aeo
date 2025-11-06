import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { SearchVisibility } from './pages/SearchVisibility';
import { AISources } from './pages/AISources';
import { SearchSources } from './pages/SearchSources';
import { Topics } from './pages/Topics';
import { Prompts } from './pages/Prompts';
import { Keywords } from './pages/Keywords';
import { Onboarding } from './pages/Onboarding';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/onboarding" element={<Onboarding />} />
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
              <SearchSources />
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
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
