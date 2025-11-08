# Quick Reference: Onboarding Feature Flags

## Environment Variables Setup

Create or update `.env.local` in the project root:

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

**Remember**: Restart dev server after changing `.env.local`!

---

## Quick Commands

### Browser Console - Clear Onboarding State
```javascript
localStorage.clear();
// Or use individual keys:
localStorage.removeItem('onboarding_complete');
localStorage.removeItem('onboarding_data');
localStorage.removeItem('onboarding_topics');
localStorage.removeItem('onboarding_prompts');
```

### Browser Console - Mark Onboarding Complete
```javascript
localStorage.setItem('onboarding_complete', 'true');
```

---

## Common Use Cases

| Goal | Set in `.env.local` |
|------|---------------------|
| Test WelcomeScreen | `VITE_ONBOARDING_STEP=welcome` |
| Test Models Step | `VITE_ONBOARDING_STEP=models` |
| Test Topics Step | `VITE_ONBOARDING_STEP=topics` |
| Test Prompts Step | `VITE_ONBOARDING_STEP=prompts` |
| Test Dashboard Only | `VITE_SKIP_ONBOARDING_CHECK=true` |
| Force Onboarding | `VITE_FORCE_ONBOARDING=true` |
| Test Topic Modal | `VITE_ENABLE_TESTING_MODE=true` |
| Skip Onboarding After Login | `VITE_SKIP_ONBOARDING_AFTER_LOGIN=true` |
| Force Onboarding After Login | `VITE_FORCE_ONBOARDING_AFTER_LOGIN=true` |
| Normal Flow | All flags set to `false` or empty |

---

## Files Created

- `src/config/featureFlags.ts` - Feature flag configuration
- `src/utils/onboardingUtils.ts` - Onboarding state utilities
- `DEVELOPMENT_GUIDE.md` - Comprehensive development guide
- `QUICK_REFERENCE.md` - This file

---

## Files Modified

- `src/pages/Dashboard.tsx` - Uses feature flags instead of hardcoded testing mode
- `src/pages/Onboarding.tsx` - Uses onboarding utilities and feature flags
- `src/pages/AuthPage.tsx` - Checks feature flags for post-login onboarding behavior
- `src/components/Onboarding/OnboardingModal.tsx` - Supports direct step access
- `src/App.tsx` - Default route respects feature flags

---

For detailed information, see `DEVELOPMENT_GUIDE.md`.

