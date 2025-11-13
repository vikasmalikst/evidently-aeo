# Settings > Manage Prompts Page

## 🎯 Overview
This PR introduces a new Settings > Manage Prompts page that provides users with a comprehensive view of their prompt coverage and management capabilities.

## ✨ Features

### Prompt Coverage Summary Dashboard
A new summary card displays key metrics at a glance:
- **Total Prompts**: Count of all prompts across all topics
- **Topics Covered**: Number of topics with prompts
- **Coverage**: Percentage with visual indicators:
  - 🟢 Green (≥90%): Excellent coverage
  - 🟡 Yellow (≥70%): Good coverage
  - 🔴 Red (<70%): Needs improvement
- **Visibility Score**: Current visibility score

### Settings Navigation
- Clean, icon-free navigation menu
- Active state indicator with 64% width underline
- Consistent layout using new `SettingsLayout` component

### Prompt Management
- View prompts grouped by topic
- Select prompts to view detailed responses
- Edit and delete prompts inline
- Add new prompts to existing topics
- Date range filtering for prompt data

## 🎨 UI/UX Improvements

### Settings Menu
- **Removed icons** for a cleaner, text-focused navigation
- **Refined underline**: Active state underline is now 64% of text width and positioned only under the text (excluding icon space)
- Improved visual hierarchy and readability

### Coverage Indicators
- Color-coded coverage percentages for quick visual assessment
- Icon indicators (✓ for good, ⚠ for needs attention)
- Consistent styling with existing design system

## 📁 New Components

- `ManagePrompts.tsx` - Main page component for prompt management
- `SettingsLayout.tsx` - Reusable layout component for settings pages
- `ManagePromptsList.tsx` - Component for displaying and managing prompts by topic
- `promptConfigAdapter.ts` - Utility functions for prompt configuration conversion

## 🔗 Routes Added

- `/settings` - Main settings page
- `/settings/manage-prompts` - Manage Prompts page

## 🧪 Testing Checklist

- [ ] Prompt coverage summary displays correct counts
- [ ] Coverage percentage color coding works correctly
- [ ] Settings navigation highlights active page
- [ ] Prompt selection and editing functionality works
- [ ] Date range filtering functions properly
- [ ] Responsive design works on different screen sizes

## 📸 Screenshots
_Add screenshots of the new Manage Prompts page and coverage summary_

## 🔄 Related Issues
_Link to any related issues or tickets_

