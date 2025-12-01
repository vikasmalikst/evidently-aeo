# Prompt Management Screens Review

## Overview
There are two different screens for editing and deleting prompts that serve the same function but have different visual designs and user experiences.

## Screen 1: ManagePromptsList
**Location:** `src/components/Settings/ManagePromptsList.tsx`  
**Used in:** Settings > Manage Prompts page (`/settings/manage-prompts`)

### Visual Design
- **Layout:** Table-based with collapsible topic sections
- **Editing:** Inline editing within table cells
- **Actions:** Edit/Delete buttons in Actions column (rightmost column)
- **Icons:** Edit2 and Trash2 from lucide-react
- **Add Prompt:** Inline form row that appears when "Add" button is clicked in topic header

### Key Features
- ✅ Table view with columns: Prompt, Volume, Sentiment, Topic, Actions
- ✅ Collapsible topics (chevron expand/collapse)
- ✅ Inline editing - clicking Edit makes the prompt text editable in place
- ✅ Inline add - clicking Add shows input field in table row
- ✅ Date range selector in header
- ✅ Row selection highlighting
- ✅ Confirmation dialog for delete

### Visual Characteristics
- Compact, data-dense layout
- Table rows with hover states
- Selected row highlighted with accent color
- Editing state shows input field replacing text
- Actions column with icon buttons

---

## Screen 2: PromptEditor
**Location:** `src/components/PromptConfiguration/PromptEditor.tsx`  
**Used in:** PromptConfigurationWorkflow (shown when changes are made in Manage Prompts)

### Visual Design
- **Layout:** Card-based, vertical list
- **Editing:** Card transforms to show textarea when editing
- **Actions:** Edit/Delete buttons on right side of each card
- **Icons:** Edit2, Trash2, Check, X from lucide-react
- **Add Prompt:** Form section at top with textarea and topic input

### Key Features
- ✅ Card-based layout with colored borders indicating state
- ✅ Visual indicators for pending changes:
  - Green border/background for added prompts
  - Yellow border/background for edited prompts
  - Red border/background for removed prompts
- ✅ Topic badges displayed on each card
- ✅ "Custom" label for custom prompts
- ✅ "Edited" badge for prompts with pending edits
- ✅ Form-based add prompt section with textarea
- ✅ Save/Cancel buttons when editing

### Visual Characteristics
- Spacious, card-focused design
- Color-coded state indicators
- Topic badges and labels
- Textarea for editing (multi-line support)
- More visual feedback for changes

---

## Comparison

### Similarities
- Both allow editing and deleting prompts
- Both use Edit2 and Trash2 icons
- Both support inline editing
- Both have add prompt functionality
- Both show prompts grouped by topic

### Key Differences

| Feature | ManagePromptsList | PromptEditor |
|---------|-------------------|--------------|
| **Layout** | Table rows | Card boxes |
| **Editing UI** | Single-line input | Multi-line textarea |
| **Visual Feedback** | Row highlighting | Color-coded borders |
| **Pending Changes** | Not shown | Visual indicators (green/yellow/red) |
| **Topic Display** | Column in table | Badge on card |
| **Add Prompt** | Inline table row | Form section at top |
| **Density** | High (compact) | Low (spacious) |
| **Context** | Direct management | Part of workflow |

---

## Issues Identified

### 1. **Inconsistent User Experience**
Users encounter two different interfaces for the same task:
- One is table-focused (ManagePromptsList)
- One is card-focused (PromptEditor)
- This creates cognitive load and confusion

### 2. **Different Editing Patterns**
- **ManagePromptsList:** Single-line input field
- **PromptEditor:** Multi-line textarea
- Prompts can be multi-line, so textarea is more appropriate

### 3. **Visual Feedback Inconsistency**
- **ManagePromptsList:** Only shows selection state
- **PromptEditor:** Shows pending changes with colors
- Users don't see what changes are pending in the table view

### 4. **Add Prompt UX Difference**
- **ManagePromptsList:** Inline row in table (can be confusing)
- **PromptEditor:** Dedicated form section (clearer)

### 5. **Missing Features in Table View**
- No visual indication of pending changes
- No topic badges visible in table
- Less context about prompt state

---

## Recommendations

### Option 1: Consolidate to Card-Based Design (Recommended)
**Rationale:** Card-based design provides better UX for:
- Multi-line prompt text
- Visual feedback for pending changes
- Clearer add prompt flow
- Better mobile responsiveness

**Changes:**
1. Replace ManagePromptsList table with card-based layout similar to PromptEditor
2. Keep the collapsible topic sections
3. Add pending changes indicators
4. Use textarea for editing
5. Move add prompt to form section at top

### Option 2: Enhance Table Design
**Rationale:** Keep table for data density but improve UX

**Changes:**
1. Add pending changes indicators (colored borders or badges)
2. Change single-line input to textarea in edit mode
3. Improve add prompt UX (form section instead of inline row)
4. Add topic badges in table
5. Show visual state indicators

### Option 3: Unified Component
**Rationale:** Create a single reusable component with layout prop

**Changes:**
1. Create `PromptManager` component with `layout` prop ('table' | 'card')
2. Share common logic between both views
3. Use same editing patterns and visual feedback
4. Allow switching between views if needed

---

## Implementation Priority

### High Priority
1. ✅ **Unify editing pattern** - Use textarea in both (prompts can be multi-line)
2. ✅ **Add pending changes indicators** - Show what's changed before saving
3. ✅ **Consistent add prompt UX** - Use form section in both

### Medium Priority
4. ✅ **Visual consistency** - Align color schemes and spacing
5. ✅ **Topic badges** - Show topics consistently in both views

### Low Priority
6. ✅ **Consider consolidation** - Evaluate if both screens are needed
7. ✅ **Mobile optimization** - Ensure both work well on mobile

---

## Code Locations

### Files to Review/Modify
- `src/components/Settings/ManagePromptsList.tsx` - Table-based view
- `src/components/PromptConfiguration/PromptEditor.tsx` - Card-based view
- `src/pages/ManagePrompts/ManagePrompts.tsx` - Main page using ManagePromptsList
- `src/components/PromptConfiguration/PromptConfigurationWorkflow.tsx` - Uses PromptEditor

### Related Components
- `src/components/Prompts/PromptsList.tsx` - Read-only view (no edit/delete)
- `src/components/PromptConfiguration/PromptConfigPanel.tsx` - Container for PromptEditor

---

## Next Steps

1. **Decision:** Choose consolidation approach (Option 1, 2, or 3)
2. **Design Review:** Align on visual design system
3. **Implementation:** Update components to be consistent
4. **Testing:** Ensure both workflows work correctly
5. **Documentation:** Update user guides if needed

