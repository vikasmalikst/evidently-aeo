feat: Add Settings > Manage Prompts page with coverage summary

## Summary
Implements a new Settings > Manage Prompts page that allows users to view and manage their tracked prompts with a comprehensive coverage summary dashboard.

## Changes

### New Features
- **Prompt Coverage Summary Card**: Added a summary dashboard at the top of the Manage Prompts page displaying:
  - Total Prompts count across all topics
  - Topics Covered count
  - Coverage percentage with color-coded indicators (green ≥90%, yellow ≥70%, red <70%)
  - Visibility Score
- **Settings Navigation**: Created a new SettingsLayout component with a clean sidebar navigation
- **Manage Prompts Page**: New page at `/settings/manage-prompts` for managing prompts grouped by topic

### UI/UX Improvements
- **Settings Menu Styling**: 
  - Removed icons from settings navigation menu for cleaner appearance
  - Updated active state underline to be 64% of text width
  - Underline now fits only the text, excluding iconography
- **Coverage Indicators**: Visual feedback with icons (CheckCircle for good coverage, AlertCircle for low coverage)

### Technical Details
- Added `ManagePrompts` page component with prompt management functionality
- Created `SettingsLayout` component for consistent settings page structure
- Implemented `ManagePromptsList` component for displaying prompts by topic
- Added route configuration for `/settings/manage-prompts`
- Integrated with existing `PromptConfigurationWorkflow` for progressive disclosure

## Files Changed
- `src/pages/ManagePrompts.tsx` (new)
- `src/pages/Settings.tsx` (new)
- `src/components/Settings/SettingsLayout.tsx` (new)
- `src/components/Settings/ManagePromptsList.tsx` (new)
- `src/App.tsx` (route added)
- `src/utils/promptConfigAdapter.ts` (new - configuration utilities)

## Testing
- Verify prompt coverage summary displays correct counts
- Confirm settings navigation highlights active page correctly
- Test prompt selection and editing functionality
- Validate coverage percentage color coding

