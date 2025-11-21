# Fix: WelcomeScreen Appearing on Dashboard Navigation

## Problem
When navigating to `/dashboard`, the WelcomeScreen appears because:
1. Dashboard checks if `onboarding_complete` exists in localStorage
2. If it doesn't exist, Dashboard redirects to `/onboarding`
3. OnboardingModal defaults to `'welcome'` step, showing WelcomeScreen

## Solutions

### Solution 1: Skip Onboarding Check (Recommended for Development)

Update your `.env.local` file:

```env
# Skip onboarding checks (for testing dashboard without onboarding)
VITE_SKIP_ONBOARDING_CHECK=true
```

Then restart your dev server: `npm run dev`

This will bypass all onboarding checks and let you access the dashboard directly.

### Solution 2: Mark Onboarding as Complete

Open your browser console and run:

```javascript
localStorage.setItem('onboarding_complete', 'true');
```

Then refresh the page. The dashboard should load without redirecting.

### Solution 3: Complete the Onboarding Flow

1. Navigate to `/onboarding`
2. Go through all steps: Welcome → Models → Topics → Prompts
3. Click "Complete Setup" at the end
4. This will automatically set `onboarding_complete` and redirect to dashboard

## Quick Fix Script

Run this in your browser console to mark onboarding as complete:

```javascript
localStorage.setItem('onboarding_complete', 'true');
localStorage.setItem('onboarding_data', JSON.stringify({
  models: ['chatgpt'],
  topics: [],
  prompts: []
}));
console.log('✅ Onboarding marked as complete');
location.reload();
```

## For Development

If you want to always skip onboarding checks during development, set in `.env.local`:

```env
VITE_SKIP_ONBOARDING_CHECK=true
VITE_FORCE_ONBOARDING=false
VITE_ONBOARDING_STEP=
VITE_ENABLE_TESTING_MODE=false
```

This will let you access the dashboard directly without going through onboarding.

