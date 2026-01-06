# Content Generation Improvement Plan

## Overview

Enhance the content generation system to create source-specific content with separate sections for collaboration emails and publishable content (articles/video scripts).

## Current State

- Single `readyToPaste` content field
- Generic content format
- No source-specific content types
- Single mode (either "post_on_source" or "pitch_collaboration")

## Requirements

### 1. Source Detection

Detect source type from `citation_source` domain:

- **YouTube**: `youtube.com`, `youtu.be` → Generate video script
- **Article Sites**: Editorial sites (e.g., TechCrunch, Forbes, Healthline) → Generate article content
- **Collaboration Targets**: External sites requiring pitch → Generate collaboration email

### 2. Content Structure Changes

#### New JSON Structure (version 2.0)

```json
{
  "version": "2.0",
  "recommendationId": "<string>",
  "brandName": "<string>",
  "targetSource": {
    "domain": "<string>",
    "sourceType": "youtube" | "article_site" | "collaboration_target" | "other",
    "mode": "post_on_source" | "pitch_collaboration",
    "rationale": "<explanation>"
  },
  "collaborationEmail": {
    "subjectLine": "<string>",
    "emailBody": "<string>",
    "cta": "<string>"
  },
  "publishableContent": {
    "type": "article" | "video_script" | "faq" | "other",
    "title": "<string>",
    "content": "<string>",
    "metadata": {
      // For articles: h1, h2, faq, snippetSummary
      // For video scripts: duration, scenes, keyPoints
    }
  },
  "keyPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "requiredInputs": ["<facts/links>"],
  "complianceNotes": ["<constraints>"]
}
```

### 3. Source-Specific Content Types

#### YouTube (Video Script)

- Format: Structured video script with timing, scenes, dialogue
- Sections: Hook, Introduction, Main Content, CTA
- Metadata: Estimated duration, key visuals, on-screen text
- Tone: Conversational, engaging, visual-oriented

#### Article Sites

- Format: Full article content ready to publish
- Structure: Introduction, Body (with H2s), Conclusion
- SEO/AEO: H1, H2 headings, FAQ section, snippet summary
- Tone: Authoritative, well-researched, citation-friendly

#### Collaboration Targets

- Format: Professional email pitch
- Structure: Subject line, email body, CTA
- Tone: Professional, value-focused, concise

## Implementation Plan

### Phase 1: Backend Changes

#### Step 1.1: Update Content Service Type Definitions

**File**: `backend/src/services/recommendations/recommendation-content.service.ts`

- Add new `GeneratedContentJsonV2` type
- Add source detection utility function:
  ```typescript
  function detectSourceType(domain: string): 'youtube' | 'article_site' | 'collaboration_target' | 'other'
  ```

- Update prompt to include source detection logic

#### Step 1.2: Update Prompt

- Add source detection instructions
- Request separate sections for collaboration email and publishable content
- Add format specifications for each content type:
  - Video script format (with timing, scenes)
  - Article format (with H1/H2/FAQ)
  - Email format (subject/body/CTA)

#### Step 1.3: Update JSON Parsing

- Support both v1.0 (backward compatibility) and v2.0 formats
- Parse new structure with separate sections
- Validate source-specific content requirements

### Phase 2: Database Schema (Optional)

- Consider adding fields to store content separately if needed
- Current JSON storage should be sufficient

### Phase 3: Frontend Changes

#### Step 3.1: Update Content Display

**File**: `src/pages/RecommendationsV3.tsx`

- Update Step 3 content rendering to show:

  1. **Collaboration Email Section** (if collaboration mode)

     - Subject line
     - Email body
     - CTA button

  1. **Publishable Content Section**

     - For articles: Full article with headings
     - For video scripts: Structured script with scenes
     - For other: Generic content display

#### Step 3.2: Add Content Type Indicators

- Show badge/icon indicating content type (video script, article, email)
- Visual separation between collaboration email and publishable content

#### Step 3.3: Copy Functionality

- Separate "Copy Email" and "Copy Content" buttons
- Format content appropriately when copying

### Phase 4: Source Detection Logic

#### YouTube Detection

```typescript
const youtubeDomains = ['youtube.com', 'youtu.be', 'm.youtube.com'];
function isYouTube(domain: string): boolean {
  return youtubeDomains.some(d => domain.includes(d));
}
```

#### Article Site Detection

- Known editorial sites list
- Pattern matching for common article domains
- Default to article if not YouTube and not collaboration target

#### Collaboration Target Detection

- Based on `mode: "pitch_collaboration"`
- Or explicit list of collaboration-only domains

## Example Outputs

### YouTube Video Script

```json
{
  "publishableContent": {
    "type": "video_script",
    "title": "The Future of Storage Technology",
    "content": "[Hook: 0:00-0:15]\nWhat if your storage could...\n\n[Scene 1: Introduction 0:15-0:45]\n...",
    "metadata": {
      "estimatedDuration": "5:00",
      "scenes": [
        {"start": "0:00", "end": "0:15", "type": "hook", "content": "..."},
        {"start": "0:15", "end": "0:45", "type": "intro", "content": "..."}
      ],
      "keyVisuals": ["Storage device close-up", "Performance graph"],
      "onScreenText": ["SanDisk - Industry Leader"]
    }
  }
}
```

### Article Content

```json
{
  "publishableContent": {
    "type": "article",
    "title": "Next-Generation Storage: A Technical Deep Dive",
    "content": "# Next-Generation Storage: A Technical Deep Dive\n\n## Understanding Modern Flash Memory Technologies\n\n...",
    "metadata": {
      "h1": "Next-Generation Storage: A Technical Deep Dive",
      "h2": ["Understanding Modern Flash Memory", "Performance Metrics", "Future Trends"],
      "faq": ["How do storage technologies impact performance?", "What are the latest advancements?"],
      "snippetSummary": "Expert insights into cutting-edge storage technologies..."
    }
  }
}
```

## Backward Compatibility

- Keep support for v1.0 format
- Auto-detect version and render accordingly
- Migrate old content when displayed

## Testing Checklist

- [ ] YouTube sources generate video scripts
- [ ] Article sites generate article content
- [ ] Collaboration targets generate email + content
- [ ] Both sections display correctly in UI
- [ ] Copy functionality works for both sections
- [ ] Backward compatibility with v1.0 format
- [ ] Source detection is accurate
- [ ] Content quality meets requirements

## Migration Strategy

1. Deploy backend changes (supports both formats)
2. Test with new recommendations
3. Update frontend to handle v2.0 format
4. Old recommendations continue to work with v1.0 display
5. Gradually migrate to v2.0 for all new content