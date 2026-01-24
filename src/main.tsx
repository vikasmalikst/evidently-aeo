import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/onboarding.css';
import './styles/onboardingModal.css';
import './styles/topics.css';

// Import cache cleanup utilities to make them available in browser console
// These help recover from cache issues (e.g., deleted brands, stale data)
import './utils/cacheCleanup';

// React StrictMode intentionally double-invokes effects in DEV, which can cause
// aborted/duplicated API calls (and heavy backend recomputation) for data-heavy pages.
// Keep DEV behavior closer to production for performance debugging.
import { HelmetProvider } from 'react-helmet-async';

const Root = (
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

createRoot(document.getElementById('root')!).render(
  Root
);
