# Manage Prompts & Topics - Deletion Flow Diagram

## Overview
This document explains the deletion flow for prompts and topics on the Manage Prompts page.

---

## 🔴 Deleting a PROMPT

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                                  │
│    User clicks Delete (🗑️) button on a prompt                  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. VALIDATION                                                   │
│    • Check if prompt has queryId (backend UUID)                │
│    • If missing → Show error, abort                            │
│    • If present → Continue                                      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PENDING CHANGE TRACKING                                      │
│    • Add prompt to pendingChanges.removed[]                     │
│    • Store: { id, text, promptId (queryId) }                   │
│    • Remove from pendingChanges.edited[] if it was being edited│
│    • Remove from UI immediately (grayed out with opacity)      │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. UI UPDATE                                                    │
│    • Prompt card shows red border & reduced opacity            │
│    • "Removed" indicator appears                               │
│    • Pending Changes Banner appears at top                     │
│    • Recalibration Warning shows                               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. USER CAN PREVIEW IMPACT (Optional)                           │
│    • Click "Preview Impact" button                             │
│    • API calculates:                                           │
│      - Coverage change                                         │
│      - Visibility score change                                 │
│      - Topic coverage changes                                  │
│      - Affected analyses count                                 │
│    • Impact Preview Modal shows results                        │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. USER CONFIRMS (or continues making changes)                  │
│    • Can make more changes (add/edit/delete more prompts)      │
│    • All changes are batched together                          │
│    • Click "Apply Changes" when ready                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. BATCH APPLY CHANGES                                          │
│    POST /brands/{brandId}/prompts/batch                        │
│    Body: {                                                     │
│      changes: {                                                │
│        removed: [{ id: queryId, text: "..." }],               │
│        added: [...],                                           │
│        edited: [...]                                           │
│      },                                                        │
│      changeSummary: "Removed X prompt(s)"                      │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. BACKEND PROCESSING                                           │
│    • Create new prompt configuration version                   │
│    • Mark prompt as inactive in configuration                  │
│    • Create version snapshot                                   │
│    • Set old version to inactive                               │
│    • Return new version number                                 │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. UI REFRESH                                                   │
│    • Reload prompts data                                       │
│    • Reset pending changes                                     │
│    • Show success state                                        │
│    • Update version indicator                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 Deleting a TOPIC

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                                  │
│    User clicks Delete (🗑️) button on a topic                   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. MODAL DISPLAY                                                │
│    Topic Delete Confirmation Modal shows:                      │
│    • Topic name                                                │
│    • Warning: "X prompts associated will also be deleted"     │
│    • List of prompts that will be deleted                      │
│    • Note: "A fresh prompts and topics version will be        │
│             created immediately after you confirm"             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
        ┌──────────────────────┐      ┌──────────────────────┐
        │   USER CANCELS       │      │   USER CONFIRMS      │
        └──────────────────────┘      └──────────────────────┘
                 │                              │
                 │                              ▼
                 │          ┌─────────────────────────────────────┐
                 │          │ 3. VALIDATION                      │
                 │          │    • Check all prompts have queryId│
                 │          │    • If missing → Show error       │
                 │          │    • Filter to deletable prompts   │
                 │          └─────────────────────────────────────┘
                 │                        │
                 │                        ▼
                 │          ┌─────────────────────────────────────┐
                 │          │ 4. DELETE ALL PROMPTS IN TOPIC      │
                 │          │    Apply batch changes:             │
                 │          │    POST /brands/{brandId}/prompts/  │
                 │          │         batch                      │
                 │          │    {                               │
                 │          │      removed: [                    │
                 │          │        { id: queryId1, text: "..."},│
                 │          │        { id: queryId2, text: "..."},│
                 │          │        ...                         │
                 │          │      ],                            │
                 │          │      added: [],                    │
                 │          │      edited: []                    │
                 │          │    }                               │
                 │          └─────────────────────────────────────┘
                 │                        │
                 │                        ▼
                 │          ┌─────────────────────────────────────┐
                 │          │ 5. UPDATE TOPIC CONFIGURATION       │
                 │          │    • Remove topic from inline topics│
                 │          │    • Call handleInlineTopicsChange()│
                 │          │    • Persist topic configuration    │
                 │          └─────────────────────────────────────┘
                 │                        │
                 │                        ▼
                 │          ┌─────────────────────────────────────┐
                 │          │ 6. UPDATE UI STATE                  │
                 │          │    • Remove topic from topics list  │
                 │          │    • Remove all prompts from state  │
                 │          │    • Close delete modal             │
                 │          └─────────────────────────────────────┘
                 │                        │
                 │                        ▼
                 │          ┌─────────────────────────────────────┐
                 │          │ 7. REFRESH DATA                     │
                 │          │    • Reload prompts from API        │
                 │          │    • Update version indicator       │
                 │          │    • Show updated topic list        │
                 │          └─────────────────────────────────────┘
                 │
                 ▼
        ┌──────────────────────┐
        │   RETURN TO PAGE     │
        │   (No changes made)  │
        └──────────────────────┘
```

---

## 📊 Key Components Involved

### Frontend Components

1. **ManagePrompts.tsx** (Main Page)
   - Manages overall state
   - Handles topic deletion modal
   - Coordinates between components

2. **ManagePromptsList.tsx** (Prompt List)
   - Handles prompt deletion
   - Tracks pending changes
   - Shows recalibration warnings

3. **InlineTopicManager.tsx** (Topic Manager)
   - Manages topic deletion requests
   - Displays topics with edit/delete options

### API Endpoints

1. **POST /brands/{brandId}/prompts/batch**
   - Applies batch changes (add/remove/edit prompts)
   - Creates new configuration version
   - Returns new version number

2. **GET /brands/{brandId}/prompts/manage**
   - Fetches current prompts and topics
   - Returns version information

3. **Topic Configuration API**
   - Updates topic configuration
   - Removes topic from active topics

---

## 🔄 State Flow

```
User Action
    │
    ├─→ Pending Changes State
    │   • added: []
    │   • removed: [{ id, text, promptId }]
    │   • edited: []
    │
    ├─→ UI Indicators
    │   • Pending changes banner
    │   • Recalibration warning
    │   • Visual changes (opacity, borders)
    │
    ├─→ Impact Calculation (Optional)
    │   • Preview modal
    │   • Coverage/visibility estimates
    │
    └─→ Batch Apply
        │
        ├─→ API Call
        │   • Create new version
        │   • Update configuration
        │
        └─→ UI Refresh
            • Reload data
            • Reset pending changes
            • Show success
```

---

## ⚠️ Important Notes

1. **No Immediate Deletion**: Deletions are tracked as pending changes and only applied when user confirms via batch apply.

2. **Version Creation**: Every batch of changes creates a new configuration version, preserving history.

3. **Topic Deletion = Prompt Deletion**: When a topic is deleted, all prompts in that topic are also deleted in the same batch operation.

4. **Validation**: Both prompt and topic deletions validate that prompts have valid `queryId` (UUID) before proceeding.

5. **Read-Only Mode**: When viewing a past version, deletion is disabled (read-only mode).

6. **Batch Operations**: Multiple deletions (or combined add/edit/delete operations) are batched together and applied as a single version change.

---

## 🎯 Visual Indicators

### Prompt Deletion States:
- **Normal**: White background, default border
- **Pending Deletion**: Red border, reduced opacity (50%), "Removed" label
- **Pending Edit**: Yellow border, "Edited" label
- **Newly Added**: Green border, "New" label

### Topic Deletion:
- Confirmation modal with warning
- Lists all prompts that will be deleted
- Immediate version creation on confirmation

