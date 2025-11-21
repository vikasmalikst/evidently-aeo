# Testing the Complete Onboarding Flow

## How to Test the Complete Flow from Start to Finish

1. **Clear localStorage** to simulate a first-time user:
   - Open browser DevTools (F12)
   - Go to Console tab
   - Run: `localStorage.clear()`
   - Navigate to `/` or refresh the page

2. **Expected Flow:**

   **Step 1: Onboarding - Brand Verification**
   - Redirects to `/onboarding` automatically
   - Enter brand name and verify
   - localStorage saves: `onboarding_brand`

   **Step 2: Onboarding - Competitor Selection**
   - Select 3-5 competitors
   - localStorage saves: `onboarding_competitors`

   **Step 3: Onboarding - Summary**
   - Review brand and competitors
   - Click "Complete Setup"
   - localStorage saves: `onboarding_complete`
   - Navigates to `/dashboard`

   **Step 4: Dashboard - Topics Selection Modal (Welcome Screen)**
   - After 500ms delay, Topic Selection Modal appears with Welcome Screen
   - Click "Let's Get Started" to see topic options
   - Select 5-10 topics (shows quality score)
   - Click "Next: Configure Prompts"
   - localStorage saves: `onboarding_topics`
   - Navigates to `/prompt-selection`

   **Step 5: Prompt Selection Page**
   - Recommended prompts are pre-selected
   - Select up to 40 prompts total
   - Readiness scale shows progress
   - Click "Analyze (X queries)" button
   - localStorage saves: `onboarding_prompts`
   - Navigates back to `/dashboard`

   **Step 6: Dashboard - Complete**
   - Dashboard loads with full data
   - No modals or redirects
   - Ready to use the application

3. **Verify localStorage at each step**:
   ```javascript
   localStorage.getItem('onboarding_brand')
   localStorage.getItem('onboarding_competitors')
   localStorage.getItem('onboarding_complete')
   localStorage.getItem('onboarding_topics')
   localStorage.getItem('onboarding_prompts')
   ```

4. **Test returning user**:
   - All 5 localStorage items should exist
   - Dashboard loads normally without modals
   - No automatic redirects occur
   - User goes directly to dashboard content

5. **Test partial completion scenarios**:
   - If only `onboarding_complete` exists: Shows topic modal
   - If `onboarding_complete` + `onboarding_topics` exist: Redirects to `/prompt-selection`
   - If none exist: Redirects to `/onboarding`

## Icons Updated

All topic icons now use Tabler Icons:
- Product Features: IconTarget
- Competitive Comparison: IconSwords
- Industry & Trends: IconChartBar
- Pricing & Value: IconCurrencyDollar
- Use Cases & Solutions: IconBulb
- Integration & Setup: IconLink
