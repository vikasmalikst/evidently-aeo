# Development & Testing Guide for Onboarding Visibility Control

This guide explains how to use the feature flags and utilities for controlling onboarding visibility during development and testing.

## Quick Start

### 1. Environment Variables

Create or update `.env.local` in the project root with these variables:

```env
# Force onboarding to show (regardless of localStorage state)
VITE_FORCE_ONBOARDING=false

# Skip onboarding checks (for testing dashboard without onboarding)
VITE_SKIP_ONBOARDING_CHECK=false

# Jump directly to a specific onboarding step
# Options: welcome, models, topics, prompts
VITE_ONBOARDING_STEP=

# Enable testing mode in Dashboard (shows topic modal for testing)
VITE_ENABLE_TESTING_MODE=false

# Skip onboarding after login (redirects directly to dashboard after login)
VITE_SKIP_ONBOARDING_AFTER_LOGIN=false

# Force onboarding after login (always redirects to onboarding after login)
VITE_FORCE_ONBOARDING_AFTER_LOGIN=false
```

**Important**: After changing `.env.local`, restart your dev server (`npm run dev`).

---

## Common Development Scenarios

### Scenario 1: Test WelcomeScreen in Isolation

**Goal**: Test the WelcomeScreen component directly without going through the full flow.

**Steps**:
1. Open `.env.local`
2. Set `VITE_ONBOARDING_STEP=welcome`
3. Restart dev server
4. Navigate to `/onboarding`
5. WelcomeScreen will be shown directly

**Reset**: Set `VITE_ONBOARDING_STEP=` (empty) to return to normal flow.

---

### Scenario 2: Test a Specific Onboarding Step

**Goal**: Jump directly to a specific step (models, topics, or prompts) for testing.

**Steps**:
1. Open `.env.local`
2. Set `VITE_ONBOARDING_STEP=models` (or `topics`, `prompts`)
3. Restart dev server
4. Navigate to `/onboarding`
5. The specified step will be shown directly

**Example**:
```env
# Test the models selection step
VITE_ONBOARDING_STEP=models

# Test the topics selection step
VITE_ONBOARDING_STEP=topics

# Test the prompts configuration step
VITE_ONBOARDING_STEP=prompts
```

---

### Scenario 3: Test Dashboard Without Onboarding

**Goal**: Test the dashboard functionality without going through onboarding.

**Steps**:
1. Open `.env.local`
2. Set `VITE_SKIP_ONBOARDING_CHECK=true`
3. Restart dev server
4. Navigate to `/dashboard`
5. Dashboard will load without redirecting to onboarding

**Note**: This bypasses all onboarding checks, so you can test dashboard features independently.

---

### Scenario 4: Force Onboarding to Always Show

**Goal**: Always redirect to onboarding, even if it's already complete.

**Steps**:
1. Open `.env.local`
2. Set `VITE_FORCE_ONBOARDING=true`
3. Restart dev server
4. Navigate to `/dashboard` (or any protected route)
5. Will always redirect to `/onboarding`

**Use Case**: Useful for testing the onboarding flow repeatedly without clearing localStorage.

---

### Scenario 5: Test Dashboard with Topic Modal

**Goal**: Test the dashboard with the topic selection modal showing.

**Steps**:
1. Open `.env.local`
2. Set `VITE_ENABLE_TESTING_MODE=true`
3. Restart dev server
4. Navigate to `/dashboard`
5. Topic modal will appear after 500ms

**Note**: This only works in development mode (`npm run dev`).

---

### Scenario 6: Test Full Onboarding Flow

**Goal**: Test the complete onboarding flow from start to finish.

**Steps**:
1. Open browser console
2. Run: `localStorage.clear()` to clear all state
3. Or use the utility: `onboardingUtils.clearOnboardingState()` (if available in console)
4. Navigate to `/onboarding`
5. Go through all steps: Welcome → Models → Topics → Prompts

**Alternative**: Set all feature flags to `false` in `.env.local` for normal flow.

---

### Scenario 7: Skip Onboarding After Login

**Goal**: Skip onboarding check after login and go directly to dashboard.

**Steps**:
1. Open `.env.local`
2. Set `VITE_SKIP_ONBOARDING_AFTER_LOGIN=true`
3. Restart dev server
4. Log in to the application
5. Will redirect directly to `/dashboard` without checking onboarding status

**Use Case**: Test dashboard features immediately after login without going through onboarding.

---

### Scenario 8: Force Onboarding After Login

**Goal**: Always show onboarding after login, even if already completed.

**Steps**:
1. Open `.env.local`
2. Set `VITE_FORCE_ONBOARDING_AFTER_LOGIN=true`
3. Restart dev server
4. Log in to the application
5. Will always redirect to `/onboarding` regardless of completion status

**Use Case**: Test onboarding flow repeatedly after login without clearing localStorage.

---

## Using Browser Console Utilities

You can use localStorage directly in the browser console to manage onboarding state:

```javascript
// Clear all onboarding state
localStorage.removeItem('onboarding_complete');
localStorage.removeItem('onboarding_data');
localStorage.removeItem('onboarding_topics');
localStorage.removeItem('onboarding_prompts');
localStorage.removeItem('onboarding_brand');
console.log('✅ Onboarding state cleared');

// Mark onboarding as complete
localStorage.setItem('onboarding_complete', 'true');
console.log('✅ Onboarding marked as complete');

// Check if onboarding is complete
localStorage.getItem('onboarding_complete') === 'true';

// Get onboarding data
const data = localStorage.getItem('onboarding_data');
const parsedData = data ? JSON.parse(data) : null;
console.log('Onboarding data:', parsedData);
```

**Note**: The `onboardingUtils` functions are not directly available in the browser console. Use localStorage directly as shown above:

```javascript
// Clear onboarding state
localStorage.removeItem('onboarding_complete');
localStorage.removeItem('onboarding_data');
localStorage.removeItem('onboarding_topics');
localStorage.removeItem('onboarding_prompts');
localStorage.removeItem('onboarding_brand');

// Mark as complete
localStorage.setItem('onboarding_complete', 'true');

// Check completion
localStorage.getItem('onboarding_complete') === 'true';
```

---

## Feature Flag Reference

### `VITE_FORCE_ONBOARDING`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: Forces redirect to `/onboarding` regardless of localStorage state
- **Use Case**: Test onboarding flow repeatedly

### `VITE_SKIP_ONBOARDING_CHECK`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: Bypasses all onboarding checks in Dashboard
- **Use Case**: Test dashboard features without onboarding

### `VITE_ONBOARDING_STEP`
- **Type**: `string` (`welcome`, `models`, `topics`, `prompts`, or empty)
- **Default**: `""` (empty)
- **Effect**: Jumps directly to the specified onboarding step
- **Use Case**: Test specific onboarding steps in isolation

### `VITE_ENABLE_TESTING_MODE`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: Shows topic modal in Dashboard (development only)
- **Use Case**: Test topic selection modal in dashboard context

### `VITE_SKIP_ONBOARDING_AFTER_LOGIN`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: Skips onboarding check after login, redirects directly to dashboard
- **Use Case**: Test dashboard features immediately after login without onboarding

### `VITE_FORCE_ONBOARDING_AFTER_LOGIN`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: Always redirects to onboarding after login, regardless of completion status
- **Use Case**: Test onboarding flow repeatedly after login

---

## Recommended Workflow

### For UI/UX Testing
1. Set `VITE_ONBOARDING_STEP=welcome` to test WelcomeScreen
2. Test each step individually: `models`, `topics`, `prompts`
3. Set `VITE_ONBOARDING_STEP=` (empty) to test full flow

### For Dashboard Testing
1. Set `VITE_SKIP_ONBOARDING_CHECK=true` to bypass onboarding
2. Test dashboard features independently
3. Set `VITE_ENABLE_TESTING_MODE=true` to test topic modal

### For Integration Testing
1. Set all flags to `false` for normal flow
2. Clear localStorage: `localStorage.clear()`
3. Test complete user journey

---

## Troubleshooting

### Feature flags not working?
- **Check**: Did you restart the dev server after changing `.env.local`?
- **Check**: Are the variable names correct? (must start with `VITE_`)
- **Check**: Is `.env.local` in the project root?

### Onboarding still showing when it shouldn't?
- **Check**: `VITE_FORCE_ONBOARDING` might be set to `true`
- **Check**: Clear localStorage: `localStorage.clear()`

### Can't access dashboard?
- **Check**: `VITE_SKIP_ONBOARDING_CHECK` might be set to `false`
- **Check**: `onboarding_complete` in localStorage might be missing
- **Solution**: Set `VITE_SKIP_ONBOARDING_CHECK=true` or mark onboarding as complete

### Testing mode not working?
- **Check**: `VITE_ENABLE_TESTING_MODE` must be `true`
- **Check**: Must be in development mode (`npm run dev`)
- **Check**: `VITE_SKIP_ONBOARDING_CHECK` should be `false`

---

## Example `.env.local` Configurations

### Normal Development (Default)
```env
VITE_FORCE_ONBOARDING=false
VITE_SKIP_ONBOARDING_CHECK=false
VITE_ONBOARDING_STEP=
VITE_ENABLE_TESTING_MODE=false
```

### Testing WelcomeScreen
```env
VITE_FORCE_ONBOARDING=false
VITE_SKIP_ONBOARDING_CHECK=false
VITE_ONBOARDING_STEP=welcome
VITE_ENABLE_TESTING_MODE=false
```

### Testing Dashboard Only
```env
VITE_FORCE_ONBOARDING=false
VITE_SKIP_ONBOARDING_CHECK=true
VITE_ONBOARDING_STEP=
VITE_ENABLE_TESTING_MODE=false
```

### Testing Topic Modal in Dashboard
```env
VITE_FORCE_ONBOARDING=false
VITE_SKIP_ONBOARDING_CHECK=false
VITE_ONBOARDING_STEP=
VITE_ENABLE_TESTING_MODE=true
```

### Force Onboarding Flow
```env
VITE_FORCE_ONBOARDING=true
VITE_SKIP_ONBOARDING_CHECK=false
VITE_ONBOARDING_STEP=
VITE_ENABLE_TESTING_MODE=false
```

---

## Production Notes

⚠️ **Important**: These feature flags are for development and testing only. In production:
- All feature flags should be set to `false` or left empty
- The application will use normal localStorage-based flow
- No testing mode will be active

Make sure to review your `.env.local` before deploying to production!

