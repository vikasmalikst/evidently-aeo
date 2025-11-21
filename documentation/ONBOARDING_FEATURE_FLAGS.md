# Post-Login Onboarding Feature Flags Guide

This guide explains how to use feature flags to control the **onboarding flow** (brand/competitors) that happens after login.

## Understanding the Flows

### Onboarding Flow (Brand/Competitors)
- **Route**: `/onboarding`
- **Steps**: Brand Input → Competitor Selection → Summary
- **Purpose**: First action after verifying account - input brand and competitors
- **Components**: `BrandInput`, `CompetitorGrid`, `Summary`

### Setup Flow (Welcome/Models/Topics/Prompts)
- **Route**: `/setup`
- **Steps**: Welcome → Models → Topics → Prompts
- **Purpose**: Configure account data (AI models, topics, prompts)
- **Components**: `SetupModal`, `WelcomeScreen`, `AIModelSelection`, etc.

## Feature Flags for Post-Login Onboarding

### Environment Variables

Add these to your `.env.local`:

```env
# Skip onboarding after login (skip brand/competitors, go directly to setup)
VITE_SKIP_ONBOARDING_AFTER_LOGIN=false

# Force onboarding after login (always show brand/competitors flow)
VITE_FORCE_ONBOARDING_AFTER_LOGIN=false
```

## Feature Flag Behavior

### `VITE_SKIP_ONBOARDING_AFTER_LOGIN`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: After login, skips the onboarding flow (brand/competitors) and goes directly to setup
- **Use Case**: Test setup flow without going through brand/competitor selection

**Flow when enabled:**
1. User logs in
2. Skips `/onboarding` (brand/competitors)
3. Goes directly to `/setup` (welcome → models → topics → prompts)

### `VITE_FORCE_ONBOARDING_AFTER_LOGIN`
- **Type**: `boolean` (`true` or `false`)
- **Default**: `false`
- **Effect**: After login, always redirects to onboarding (brand/competitors) regardless of completion status
- **Use Case**: Test onboarding flow repeatedly after login

**Flow when enabled:**
1. User logs in
2. Always redirects to `/onboarding` (brand/competitors)
3. After completing onboarding, goes to `/setup`

## Normal Flow (No Flags)

When no feature flags are set:

1. **User logs in**
2. **Check onboarding completion**:
   - If `onboarding_complete` is not set → Go to `/onboarding` (brand/competitors)
   - If `onboarding_complete` is set → Check setup completion
3. **Check setup completion**:
   - If setup is not complete → Go to `/setup` (welcome → models → topics → prompts)
   - If setup is complete → Go to `/dashboard`

## Example Scenarios

### Scenario 1: Skip Onboarding, Test Setup Only

```env
VITE_SKIP_ONBOARDING_AFTER_LOGIN=true
```

**Result**: After login → `/setup` (skips brand/competitors)

### Scenario 2: Force Onboarding Flow

```env
VITE_FORCE_ONBOARDING_AFTER_LOGIN=true
```

**Result**: After login → `/onboarding` (always shows brand/competitors)

### Scenario 3: Normal Flow

```env
VITE_SKIP_ONBOARDING_AFTER_LOGIN=false
VITE_FORCE_ONBOARDING_AFTER_LOGIN=false
```

**Result**: After login → Checks completion status and redirects accordingly

## Priority Order

The post-login logic checks flags in this order:

1. `VITE_SKIP_ONBOARDING_AFTER_LOGIN` → Skip onboarding, go to setup
2. `VITE_SKIP_SETUP_AFTER_LOGIN` or `VITE_SKIP_SETUP_CHECK` → Skip everything, go to dashboard
3. `VITE_FORCE_ONBOARDING_AFTER_LOGIN` → Force onboarding
4. `VITE_FORCE_SETUP_AFTER_LOGIN` or `VITE_FORCE_SETUP` → Force setup
5. Normal flow → Check completion status

## Quick Reference

| Goal | Set in `.env.local` |
|------|---------------------|
| Skip onboarding, test setup | `VITE_SKIP_ONBOARDING_AFTER_LOGIN=true` |
| Force onboarding flow | `VITE_FORCE_ONBOARDING_AFTER_LOGIN=true` |
| Normal flow | Both flags set to `false` |

## Important Notes

- **Restart dev server** after changing `.env.local`
- Onboarding flow saves to `onboarding_brand` and `onboarding_competitors` in localStorage
- Setup flow saves to `onboarding_complete` and `onboarding_data` in localStorage
- The two flows are separate and can be controlled independently

