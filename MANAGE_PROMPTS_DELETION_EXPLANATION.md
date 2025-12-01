# Manage Prompts & Topics - Deletion Flow Explanation

## Quick Overview

This document explains what happens when you delete a **prompt** or **topic** on the Manage Prompts page. 

> **Note**: Based on the current codebase, deletions affect the entire prompt configuration system. If you're referring to "agent chat only" deletion (where prompts are removed only from agent chat but remain in dashboard analytics), that functionality would need to be implemented separately.

---

## 🗑️ DELETING A PROMPT - Step by Step

### Visual Flow:

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: User Clicks Delete Button                      │
│  Location: ManagePromptsList.tsx → handleDeleteClick()  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Validation Check                               │
│  • Verify prompt has queryId (UUID from backend)        │
│  • If missing → Show error, stop                        │
│  • If valid → Continue                                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Add to Pending Changes                         │
│  State: pendingChanges.removed[]                        │
│  Data: { id, text, promptId }                           │
│                                                          │
│  Note: Prompt is NOT deleted yet!                       │
│  Just marked for deletion when changes are applied.     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Immediate UI Update                            │
│  • Prompt card shows red border                         │
│  • Opacity reduced to 50% (faded)                       │
│  • "Removed" indicator appears                          │
│  • Prompt removed from UI list immediately              │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Warning Banner Appears                         │
│  • Pending Changes Indicator shows                      │
│  • Recalibration Warning displays                       │
│  • "Preview Impact" button available                    │
└─────────────────────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
          ┌─────────┘         └─────────┐
          │                             │
          ▼                             ▼
┌──────────────────┐          ┌──────────────────┐
│ STEP 6a:         │          │ STEP 6b:         │
│ Preview Impact   │          │ Make More        │
│ (Optional)       │          │ Changes          │
│                  │          │                  │
│ Shows estimated  │          │ User can add/    │
│ coverage,        │          │ edit/delete      │
│ visibility       │          │ more prompts     │
│ changes          │          │                  │
└──────────────────┘          └──────────────────┘
          │                             │
          └────────────┬────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 7: User Applies All Changes                       │
│  • Clicks "Apply Changes" or "Confirm" button           │
│  • All pending changes (add/edit/delete) are batched    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 8: API Call - Batch Apply                         │
│  POST /brands/{brandId}/prompts/batch                   │
│                                                          │
│  Request Body:                                          │
│  {                                                     │
│    changes: {                                          │
│      removed: [                                        │
│        { id: "uuid-here", text: "prompt text..." }    │
│      ],                                                │
│      added: [...],                                     │
│      edited: [...]                                     │
│    },                                                  │
│    changeSummary: "Removed 1 prompt(s)"                │
│  }                                                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 9: Backend Processing                             │
│  • Create new prompt_configuration record               │
│  • Increment version number                             │
│  • Create prompt_configuration_snapshots                │
│    with isIncluded = false for deleted prompts          │
│  • Set previous version to inactive                     │
│  • Return new version number                            │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 10: UI Refresh                                    │
│  • Reload prompts data from API                         │
│  • Clear pending changes                                │
│  • Show success message                                 │
│  • Update version indicator                             │
│  • Prompt no longer visible in list                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🗑️ DELETING A TOPIC - Step by Step

### Visual Flow:

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: User Clicks Delete on Topic                    │
│  Location: InlineTopicManager.tsx → Delete button       │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Show Confirmation Modal                        │
│                                                          │
│  Modal Content:                                         │
│  ┌──────────────────────────────────────────────┐      │
│  │ Delete "Topic Name"?                         │      │
│  │                                               │      │
│  │ Warning: 5 prompts associated with this      │      │
│  │ topic will also be deleted.                  │      │
│  │                                               │      │
│  │ List of prompts that will be deleted:        │      │
│  │ • Prompt 1                                   │      │
│  │ • Prompt 2                                   │      │
│  │ ...                                          │      │
│  │                                               │      │
│  │ Note: A fresh prompts and topics version     │      │
│  │ will be created immediately.                 │      │
│  │                                               │      │
│  │  [Cancel]  [Delete topic]                    │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │         │
                    ▼         ▼
            ┌──────────┐  ┌──────────┐
            │ Cancel   │  │ Confirm  │
            │          │  │          │
            └──────────┘  └──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Validation                                     │
│  • Check all prompts have queryId                       │
│  • Filter to deletable prompts (those with IDs)         │
│  • If any missing → Show error, stop                    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Delete All Prompts in Topic                    │
│                                                          │
│  Apply batch changes to remove all prompts:             │
│  POST /brands/{brandId}/prompts/batch                   │
│                                                          │
│  {                                                     │
│    changes: {                                          │
│      removed: [                                        │
│        { id: "uuid-1", text: "prompt 1" },            │
│        { id: "uuid-2", text: "prompt 2" },            │
│        ... (all prompts in topic)                      │
│      ],                                                │
│      added: [],                                        │
│      edited: []                                        │
│    },                                                  │
│    changeSummary: "Removed X prompts after deleting    │
│                    topic 'Topic Name'"                 │
│  }                                                     │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Remove Topic from Configuration                │
│                                                          │
│  • Update inlineTopics (remove topic from array)        │
│  • Call handleInlineTopicsChange()                      │
│  • Persist topic configuration changes                  │
│  • Update state to remove topic                         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 6: Close Modal & Refresh                          │
│                                                          │
│  • Close delete confirmation modal                      │
│  • Reload prompts data from API                         │
│  • Topic no longer appears in list                      │
│  • All prompts from topic removed                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Key Concepts

### 1. **Pending Changes System**
- Deletions are NOT immediate
- Changes are tracked in a "pending changes" state
- User can preview, modify, or cancel before applying
- All changes (add/edit/delete) are batched together

### 2. **Version Control**
- Each batch of changes creates a new configuration version
- Previous versions are preserved for history
- You can view past versions but cannot edit them (read-only)

### 3. **Batch Operations**
- Multiple deletions are grouped together
- Single API call applies all changes
- More efficient than individual delete operations

### 4. **Validation**
- Prompts must have valid `queryId` (UUID from backend)
- If validation fails, operation stops with error message
- Prevents accidental or invalid deletions

---

## 🔄 Component Interaction

```
ManagePrompts.tsx (Main Page)
    │
    ├─→ InlineTopicManager.tsx (Topic Management)
    │   └─→ onTopicDeleteRequest()
    │       └─→ Shows confirmation modal
    │           └─→ handleConfirmTopicDeletion()
    │               ├─→ applyBatchChanges() (API)
    │               └─→ handleInlineTopicsChange()
    │
    └─→ ManagePromptsList.tsx (Prompt Management)
        └─→ handleDeleteClick()
            └─→ deletePrompt()
                ├─→ Add to pendingChanges.removed[]
                └─→ onPromptDelete() (callback)
                    └─→ Update UI state
                        └─→ When user confirms:
                            └─→ applyBatchChanges() (API)
```

---

## 🎯 What Happens to Deleted Items?

### Prompts:
- Marked as `isIncluded: false` in configuration snapshot
- Removed from active configuration
- Still exist in database (for history)
- Not included in future analyses
- Previous analyses remain unchanged

### Topics:
- Removed from topic configuration
- All prompts in topic are also deleted
- Topic no longer appears in UI
- Historical data preserved

---

## ⚠️ Important Notes

1. **No Undo Button**: Once changes are applied, they create a new version. You can't undo, but you can revert to a previous version.

2. **Historical Data Preserved**: Deletions don't affect past analyses or historical data.

3. **Read-Only Mode**: When viewing a past version, all delete buttons are disabled.

4. **Validation Required**: Both prompts and topics require valid IDs before deletion can proceed.

5. **Cascading Deletion**: Deleting a topic automatically deletes all prompts within it.

---

## 💡 About "Agent Chat Only" Deletion

Based on the current codebase, there is **no separate "agent chat only" deletion scope**. When you delete a prompt or topic:

- It's removed from the entire prompt configuration
- It affects all systems that use that configuration
- The deletion is global, not scoped to a specific feature

If you need "agent chat only" deletion functionality (where prompts are removed from agent chat but remain in dashboard analytics), this would require:

1. Adding a `scope` or `usage` field to prompts
2. Modifying deletion logic to respect scope
3. Updating the UI to allow scope selection
4. Filtering prompts by scope in different features

This is not currently implemented in the codebase.

