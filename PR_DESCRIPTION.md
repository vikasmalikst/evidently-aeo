# Topic Management UI Refactor and Development Improvements

## Overview
This PR refactors the topic management interface with improved filtering, better UX, and adds development authentication bypass functionality.

## Changes

### 🎨 Topic Management UI Improvements

#### TopicEditModal Refactor
- **Tab-based filtering**: Replaced section-based layout with intuitive tabs (All Topics, Trending, Recommended, General)
- **Category filtering**: Click category pills on topics to filter by search intent (Awareness, Comparison, Purchase, Support)
- **Progress indicator**: Visual progress bar showing topic selection count (5-10 topics) with color-coded feedback
- **Currently Tracking section**: Displays selected topics as removable chips at the top of the modal
- **Inline custom topic input**: Streamlined Add Topic functionality with inline input field
- **Enhanced review step**: Improved visual feedback showing:
  - Added/removed topics with color-coded badges
  - Impact on analysis (new queries, estimated time, version changes)
  - Clear messaging about data preservation
- **Floating info tip**: Helpful tooltip explaining how to use filters (dismissible)

#### Settings Navigation Updates
- Updated navigation labels from "Topic Configuration" to "Manage Topics" for consistency
- Applied changes to both SettingsLayout sidebar and Settings page

### 🔧 Chart Controls Enhancement
- **Brand selector**: Added dropdown to switch between brands when multiple brands are available
- Improved dropdown selection logic to properly handle brand filtering

### 🛠️ Development Improvements

#### Authentication Bypass
- Added `BYPASS_AUTH_IN_DEV` environment variable support
- Updated auth middleware to bypass authentication in development mode
- Sets mock dev user when bypass is enabled (useful for local development)
- Only active when `NODE_ENV=development` and `BYPASS_AUTH_IN_DEV=true`

### 📊 Search Visibility Updates
- Updated SearchVisibility page to pass brand props to ChartControls
- Enables brand switching directly from chart controls

## Technical Details

### Modified Files
- `src/pages/BrandSettings/components/TopicEditModal.tsx` - Major UI refactor
- `src/pages/BrandSettings/TopicManagementSettings.tsx` - Pass currentVersion prop
- `src/components/Settings/SettingsLayout.tsx` - Update navigation label
- `src/pages/Settings.tsx` - Update page title
- `src/components/Visibility/ChartControls.tsx` - Add brand selector
- `src/pages/SearchVisibility.tsx` - Pass brand props to ChartControls
- `backend/src/config/environment.ts` - Add bypassAuthInDev config
- `backend/src/middleware/auth.middleware.ts` - Implement dev auth bypass

## UI/UX Improvements

### Topic Selection Flow
1. **Selection**: Users can filter by section (All/Trending/Recommended/General) and category
2. **Progress tracking**: Visual feedback on selection count with color indicators
3. **Quick removal**: Remove topics directly from "Currently Tracking" section
4. **Review**: Clear summary of changes before confirmation

### Visual Enhancements
- Consistent use of design system tokens
- Improved spacing and typography
- Better visual hierarchy with color-coded sections
- Responsive grid layouts for topic cards

## Development Experience

### Auth Bypass Usage
To enable development authentication bypass:
```bash
BYPASS_AUTH_IN_DEV=true NODE_ENV=development npm run dev
```

This sets a mock dev user with:
- ID: `dev-user-123`
- Email: `dev@evidently.ai`
- Customer ID: Test Brand customer ID
- Role: `admin`

## Testing

### Topic Management
- ✅ Filter topics by section (All/Trending/Recommended/General)
- ✅ Filter topics by category via category pills
- ✅ Add/remove topics with visual feedback
- ✅ Review changes before saving
- ✅ Custom topic creation

### Chart Controls
- ✅ Brand selector appears when multiple brands available
- ✅ Brand switching updates visibility data

### Development
- ✅ Auth bypass works in development mode
- ✅ Mock user is properly set when bypass enabled

## Breaking Changes
None - All changes are backward compatible.

## Future Enhancements
- Search functionality within topic selection
- Topic recommendations based on brand/industry
- Bulk topic operations
- Topic templates/presets
