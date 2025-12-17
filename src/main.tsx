import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/onboarding.css';
import './styles/topics.css';

// React StrictMode intentionally double-invokes effects in DEV, which can cause
// aborted/duplicated API calls (and heavy backend recomputation) for data-heavy pages.
// Keep DEV behavior closer to production for performance debugging.
const Root = <App />;

createRoot(document.getElementById('root')!).render(
  Root
);
