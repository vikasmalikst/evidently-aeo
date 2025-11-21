# Clear Onboarding State

The console shows "All complete – redirecting to dashboard", which means the app thinks onboarding is already complete.

## Quick Fix: Clear Onboarding State

Open your browser console and run:

```javascript
// Clear all onboarding state
localStorage.removeItem('onboarding_complete');
localStorage.removeItem('onboarding_brand');
localStorage.removeItem('onboarding_competitors');
localStorage.removeItem('onboarding_data');
localStorage.removeItem('onboarding_topics');
localStorage.removeItem('onboarding_prompts');

// Reload the page
location.reload();
```

## Or Force Onboarding to Show

Add this to your `.env.local`:

```env
VITE_FORCE_ONBOARDING_AFTER_LOGIN=true
```

Then restart your dev server. This will force onboarding to show after login regardless of completion status.

## Check Current State

To see what's currently set, run in console:

```javascript
console.log('onboarding_complete:', localStorage.getItem('onboarding_complete'));
console.log('onboarding_brand:', localStorage.getItem('onboarding_brand'));
console.log('onboarding_data:', localStorage.getItem('onboarding_data'));
```

