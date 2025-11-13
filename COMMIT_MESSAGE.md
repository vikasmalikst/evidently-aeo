feat: Add Topic Configuration page with inline expandable prompts and improved review modal

## Summary
Implements a new Topic Configuration page under Settings with inline expandable prompts, improved review changes modal, and design system alignment.

## Changes

### New Features
- **Topic Configuration Page**: New page at `/settings/manage-topics` for managing topic configurations
- **Inline Expandable Prompts**: Converted floating sidebar to inline expandable sections with chevron indicators
- **Configuration History**: Integrated history section into Current Configuration card
- **Review Changes Modal**: Enhanced modal with design system styling and improved visual feedback

### UI/UX Improvements
- **Inline Topic Prompts**: 
  - Prompts now expand inline within topic blocks
  - ChevronRight icon when closed, ChevronDown when expanded
  - All topics can be expanded simultaneously
  - Removed copy functionality from prompts
- **Settings Navigation**: 
  - Updated active state underline to full text width with 2px padding
  - Improved visual alignment
- **Review Changes Modal**:
  - Replaced emojis with design system icons
  - Green highlighting for added topics, red for removed topics
  - Improved icon and text alignment
  - Better typography hierarchy and spacing
- **Page Layout**:
  - Set max-width of 1200px for main content
  - Adjusted top spacing for better header separation
  - Removed "Reset to Setup" button
  - Removed "Prompts Generated" section

### Technical Details
- Created `TopicManagementSettings` page component
- Created `ActiveTopicsSection` with inline expandable prompts
- Created `CurrentConfigCard` with integrated history
- Created `TopicEditModal` with improved review step
- Updated `SettingsLayout` with improved navigation styling
- Added route configuration for `/settings/manage-topics`

## Files Changed
- `src/pages/BrandSettings/TopicManagementSettings.tsx` (new)
- `src/pages/BrandSettings/components/ActiveTopicsSection.tsx` (new)
- `src/pages/BrandSettings/components/CurrentConfigCard.tsx` (new)
- `src/pages/BrandSettings/components/TopicEditModal.tsx` (new)
- `src/components/Settings/SettingsLayout.tsx` (updated)
- `src/pages/Settings.tsx` (updated)
- `src/App.tsx` (route added)

## Testing
- Verify topic expansion/collapse functionality
- Confirm review changes modal displays correctly
- Test topic addition/removal highlighting
- Validate settings navigation active states
- Check responsive behavior
