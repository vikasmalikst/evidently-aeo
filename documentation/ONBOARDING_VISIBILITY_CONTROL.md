# Onboarding & WelcomeScreen Visibility Control

## Current Implementation Overview

### 1. **Routing-Based Visibility** (`src/App.tsx`)
- **Onboarding Route**: `/onboarding` → Renders `<Onboarding />` component (unprotected)
- **Default Route**: `/` → Redirects to `/onboarding`
- **Dashboard Route**: `/dashboard` → Protected route that checks onboarding completion

### 2. **LocalStorage-Based State Management**
The application uses localStorage keys to track onboarding completion:
- `onboarding_complete` - Set to `'true'` when onboarding is finished
- `onboarding_data` - Stores the complete onboarding data (JSON)
- `onboarding_topics` - Stores selected topics (JSON)
- `onboarding_prompts` - Stores selected prompts (JSON)
- `onboarding_brand` - Stores brand information (JSON)

### 3. **Component Flow**

#### **WelcomeScreen** (`src/components/Topics/WelcomeScreen.tsx`)
- **Visibility**: Controlled by `OnboardingModal` component state
- **Rendered when**: `currentStep === 'welcome'` in `OnboardingModal`
- **No direct visibility control** - always renders when parent shows it

#### **OnboardingModal** (`src/components/Onboarding/OnboardingModal.tsx`)
- **Visibility**: Controlled by route (`/onboarding`)
- **Internal State**: Uses `useState` to manage current step:
  - `'welcome'` → Shows `WelcomeScreen`
  - `'models'` → Shows `AIModelSelection`
  - `'topics'` → Shows `TopicSelectionModal`
  - `'prompts'` → Shows `PromptConfiguration`
- **Completion**: Calls `onComplete` callback which sets localStorage and navigates

#### **Onboarding Page** (`src/pages/Onboarding.tsx`)
- **Always renders** `OnboardingModal` when route is `/onboarding`
- **No conditional rendering** - relies on routing

#### **Dashboard** (`src/pages/Dashboard.tsx`)
- **Checks localStorage** on mount via `useEffect`
- **Redirects to `/onboarding`** if `onboarding_complete` is not set
- **Currently has TESTING MODE** that forces topic modal to show (lines 70-76)
- **Production code is commented out** (lines 78-94)

## Current Issues & Problems

### 1. **Hardcoded Testing Mode in Production Code**
```typescript
// TESTING MODE: Always show topic modal for team review
console.log('TESTING MODE: Forcing topic modal to show');
const timer = setTimeout(() => {
  setShowTopicModal(true);
}, 500);
```
**Problem**: Testing code is mixed with production code, making it hard to control visibility for different environments.

### 2. **No Environment-Based Control**
- No environment variables to control onboarding visibility
- No feature flags or configuration files
- Hard to test different onboarding states without manually clearing localStorage

### 3. **LocalStorage Dependency**
- All state is stored in localStorage
- No way to easily reset onboarding state for testing
- No way to simulate different onboarding completion states

### 4. **No Direct Route to WelcomeScreen**
- WelcomeScreen is only accessible through the full onboarding flow
- Cannot directly test WelcomeScreen in isolation
- Must go through routing and localStorage checks

## Recommended Best Practices for Development & Testing

### 1. **Create Environment-Based Feature Flags**

Create a configuration system using environment variables:

```typescript
// src/config/featureFlags.ts
export const featureFlags = {
  // Force show onboarding regardless of localStorage
  forceOnboarding: import.meta.env.VITE_FORCE_ONBOARDING === 'true',
  
  // Skip onboarding checks (for testing)
  skipOnboardingCheck: import.meta.env.VITE_SKIP_ONBOARDING_CHECK === 'true',
  
  // Show specific onboarding step directly
  onboardingStep: import.meta.env.VITE_ONBOARDING_STEP as 'welcome' | 'models' | 'topics' | 'prompts' | null,
  
  // Enable testing mode in Dashboard
  enableTestingMode: import.meta.env.VITE_ENABLE_TESTING_MODE === 'true',
};
```

### 2. **Create a Development Helper Utility**

```typescript
// src/utils/onboardingUtils.ts
export const onboardingUtils = {
  // Clear all onboarding state
  clearOnboardingState: () => {
    localStorage.removeItem('onboarding_complete');
    localStorage.removeItem('onboarding_data');
    localStorage.removeItem('onboarding_topics');
    localStorage.removeItem('onboarding_prompts');
    localStorage.removeItem('onboarding_brand');
  },
  
  // Set onboarding as complete
  setOnboardingComplete: (data?: OnboardingData) => {
    localStorage.setItem('onboarding_complete', 'true');
    if (data) {
      localStorage.setItem('onboarding_data', JSON.stringify(data));
    }
  },
  
  // Check if onboarding is complete
  isOnboardingComplete: (): boolean => {
    return localStorage.getItem('onboarding_complete') === 'true';
  },
  
  // Get onboarding data
  getOnboardingData: (): OnboardingData | null => {
    const data = localStorage.getItem('onboarding_data');
    return data ? JSON.parse(data) : null;
  },
};
```

### 3. **Update Dashboard to Use Feature Flags**

```typescript
// src/pages/Dashboard.tsx
import { featureFlags } from '../config/featureFlags';
import { onboardingUtils } from '../utils/onboardingUtils';

useEffect(() => {
  // Skip onboarding check if feature flag is set
  if (featureFlags.skipOnboardingCheck) {
    console.log('Skipping onboarding check (feature flag enabled)');
    return;
  }
  
  // Force onboarding if feature flag is set
  if (featureFlags.forceOnboarding) {
    console.log('Forcing onboarding (feature flag enabled)');
    navigate('/onboarding');
    return;
  }
  
  // Normal flow
  if (!onboardingUtils.isOnboardingComplete()) {
    navigate('/onboarding');
    return;
  }
  
  // Testing mode (only in development)
  if (featureFlags.enableTestingMode && import.meta.env.DEV) {
    console.log('Testing mode enabled - showing topic modal');
    const timer = setTimeout(() => {
      setShowTopicModal(true);
    }, 500);
    return () => clearTimeout(timer);
  }
  
  // Production code
  // ... rest of the logic
}, [navigate]);
```

### 4. **Add Direct Route for Testing WelcomeScreen**

```typescript
// src/App.tsx
<Route 
  path="/onboarding/welcome" 
  element={
    <OnboardingModal
      brandName="Test Brand"
      industry="Technology"
      onComplete={(data) => {
        console.log('Onboarding complete:', data);
      }}
      onClose={() => navigate('/dashboard')}
    />
  } 
/>
```

### 5. **Create a Development Control Panel** (Optional)

For easier testing, create a dev-only control panel:

```typescript
// src/components/Dev/OnboardingControlPanel.tsx
// Only render in development mode
if (import.meta.env.DEV) {
  return (
    <div className="dev-control-panel">
      <button onClick={() => onboardingUtils.clearOnboardingState()}>
        Clear Onboarding
      </button>
      <button onClick={() => onboardingUtils.setOnboardingComplete()}>
        Mark Complete
      </button>
      <button onClick={() => navigate('/onboarding')}>
        Go to Onboarding
      </button>
    </div>
  );
}
```

### 6. **Update OnboardingModal to Support Direct Step Access**

```typescript
// src/components/Onboarding/OnboardingModal.tsx
export const OnboardingModal = ({ ... }) => {
  // Support direct step access via feature flag
  const initialStep = featureFlags.onboardingStep || 'welcome';
  const [currentStep, setCurrentStep] = useState<Step>(initialStep);
  
  // ... rest of component
};
```

## Recommended Environment Variables

Add to `.env.local` for development:

```env
# Force onboarding to show
VITE_FORCE_ONBOARDING=false

# Skip onboarding completion checks
VITE_SKIP_ONBOARDING_CHECK=false

# Jump directly to a specific onboarding step
# Options: welcome, models, topics, prompts
VITE_ONBOARDING_STEP=

# Enable testing mode in Dashboard
VITE_ENABLE_TESTING_MODE=false
```

## Testing Scenarios

### Scenario 1: Test WelcomeScreen in Isolation
1. Set `VITE_ONBOARDING_STEP=welcome` in `.env.local`
2. Navigate to `/onboarding`
3. WelcomeScreen will be shown directly

### Scenario 2: Test Full Onboarding Flow
1. Clear localStorage: `localStorage.clear()` in browser console
2. Navigate to `/onboarding`
3. Go through all steps

### Scenario 3: Test Dashboard with Incomplete Onboarding
1. Set `VITE_SKIP_ONBOARDING_CHECK=true`
2. Navigate to `/dashboard`
3. Dashboard will load without redirecting

### Scenario 4: Test Specific Onboarding Step
1. Set `VITE_ONBOARDING_STEP=models` (or topics, prompts)
2. Navigate to `/onboarding`
3. That specific step will be shown directly

### Scenario 5: Force Onboarding to Show
1. Set `VITE_FORCE_ONBOARDING=true`
2. Navigate to `/dashboard`
3. Will always redirect to onboarding

## Implementation Priority

1. **High Priority**: 
   - Create `featureFlags.ts` configuration
   - Create `onboardingUtils.ts` utility
   - Update Dashboard to use feature flags
   - Remove hardcoded testing mode

2. **Medium Priority**:
   - Add direct route for WelcomeScreen testing
   - Update OnboardingModal to support direct step access
   - Add environment variable documentation

3. **Low Priority**:
   - Create development control panel
   - Add automated testing helpers

## Summary

The current implementation relies heavily on localStorage and routing, with testing code mixed into production code. The recommended approach uses environment-based feature flags to control visibility, making it easy to test different scenarios without modifying code or manually clearing localStorage.

