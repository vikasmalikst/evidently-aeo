# Manage Prompts & Topics - Deletion Flow (Simple Diagram)

## 🗑️ Deleting a PROMPT

```
User Clicks Delete Button on Prompt
           │
           ▼
    ┌──────────────┐
    │  Validate    │ ← Check if prompt has queryId
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Add to       │ ← Mark as "pending deletion"
    │ Pending      │   (Not deleted yet!)
    │ Changes      │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Update UI    │ ← Prompt shows as "removed"
    │              │   (Red border, faded)
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Show         │ ← Warning banner appears
    │ Warning      │   "Changes pending"
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ User can:    │
    │ • Preview    │ ← Optional: See impact
    │   Impact     │
    │ • Make more  │ ← Or continue editing
    │   changes    │
    │ • Apply All  │ ← Confirm all changes
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Batch Apply  │ ← All changes sent together
    │              │   POST /brands/{id}/prompts/batch
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Backend:     │
    │ • Create new │
    │   version    │
    │ • Mark prompt│
    │   inactive   │
    └──────────────┘
           │
           ▼
    ┌──────────────┐
    │ Refresh UI   │ ← Reload data, show success
    └──────────────┘
```

---

## 🗑️ Deleting a TOPIC

```
User Clicks Delete Button on Topic
           │
           ▼
    ┌──────────────┐
    │ Show         │ ← Confirmation modal appears
    │ Confirmation │   "Delete topic 'X'?"
    │ Modal        │   "Y prompts will also be deleted"
    └──────────────┘
           │
      ┌────┴────┐
      │         │
      │ Cancel  │ Confirm
      │         │
      ▼         ▼
    Return   ┌──────────────┐
             │ Validate all │ ← Check all prompts have IDs
             │ prompts      │
             └──────────────┘
                    │
                    ▼
             ┌──────────────┐
             │ Step 1:      │
             │ Delete all   │ ← Remove all prompts in topic
             │ prompts      │   via batch API
             └──────────────┘
                    │
                    ▼
             ┌──────────────┐
             │ Step 2:      │
             │ Remove topic │ ← Update topic configuration
             │ from config  │
             └──────────────┘
                    │
                    ▼
             ┌──────────────┐
             │ Step 3:      │
             │ Refresh UI   │ ← Reload data, close modal
             └──────────────┘
```

---

## 📋 Quick Summary

### Prompt Deletion:
1. ✅ Click delete → Marked as "pending"
2. ✅ Shows in UI as removed (but not deleted yet)
3. ✅ User can preview impact or make more changes
4. ✅ When ready, user applies all changes at once
5. ✅ Backend creates new version, marks prompt inactive
6. ✅ UI refreshes with updated data

### Topic Deletion:
1. ✅ Click delete → Confirmation modal appears
2. ✅ Modal shows warning about prompts being deleted
3. ✅ User confirms → All prompts deleted first
4. ✅ Topic removed from configuration
5. ✅ New version created automatically
6. ✅ UI refreshes

---

## 🔑 Key Points

- **Not Immediate**: Deletions are tracked as "pending changes" first
- **Batched**: All changes (add/edit/delete) are applied together
- **Versioned**: Each batch creates a new configuration version
- **Reversible**: Past versions are preserved in history
- **Safe**: Validations prevent invalid deletions

---

## 🎨 Visual States

```
Normal Prompt:
┌─────────────────────────┐
│ Prompt text here...     │
│ [Edit] [Delete]         │
└─────────────────────────┘

Pending Deletion:
┌─────────────────────────┐
│ Prompt text here...     │ ← Faded (50% opacity)
│ [Removed]               │ ← Red border
└─────────────────────────┘

After Applied:
┌─────────────────────────┐
│ (Prompt removed)        │ ← Not visible anymore
└─────────────────────────┘
```

