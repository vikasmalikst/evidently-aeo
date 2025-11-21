# Onboarding vs Setup Modal Style Alignment

## Current Differences

### Onboarding Modals (BrandInput, CompetitorGrid, Summary)
- **Layout**: Full page with header and main content area
- **Structure**: `.onboarding-container` → `.onboarding-header` → `.onboarding-main` → `.onboarding-step__content`
- **Presentation**: Card-based content, no modal overlay
- **Navigation**: No back button in header, back button in actions area
- **Step Indicator**: None
- **Buttons**: Uses `Button` component with CSS classes `.onboarding-button--primary` and `.onboarding-button--secondary`
- **Button Style**: Different from setup modals (uses `var(--accent500)` background)

### Setup Modals (Welcome, Models, Topics, Prompts)
- **Layout**: Modal overlay with centered modal container
- **Structure**: `.onboarding-modal-overlay` → `.onboarding-modal-container` → `.onboarding-modal-header/body/footer`
- **Presentation**: Modal-style with overlay background
- **Navigation**: Back button in header (`.onboarding-back-button`)
- **Step Indicator**: Top right corner (`.step-indicator`)
- **Buttons**: Uses `.onboarding-button-primary` class directly
- **Button Style**: `#282c34` background with white text, cyan outline on hover/focus

## Recommended Changes

### 1. Convert Onboarding to Modal Layout
**Change**: Convert onboarding modals from full-page layout to modal overlay layout to match setup modals.

**Files to modify**:
- `src/pages/Onboarding.tsx` - Wrap content in modal overlay
- `src/styles/onboarding.css` - Add modal overlay styles or reuse from `onboardingModal.css`

### 2. Add Step Indicator
**Change**: Add step indicator to onboarding modals showing progress (Brand → Competitors → Summary).

**Implementation**: 
- Create or reuse step indicator component
- Position in top right corner like setup modals
- Show: Brand (active), Competitors (pending), Summary (pending)

### 3. Add Back Button to Header
**Change**: Move back button from actions area to header, matching setup modal pattern.

**Implementation**:
- Add `.onboarding-modal-header` structure
- Include back button with `.onboarding-back-button` class
- Center title in header

### 4. Align Button Styles
**Change**: Update onboarding button styles to match setup modal button styles.

**Current**:
- `.onboarding-button--primary`: `var(--accent500)` background
- `.onboarding-button--secondary`: Transparent with border

**Target**:
- `.onboarding-button-primary`: `#282c34` background, white text, cyan outline on hover/focus
- `.onboarding-button-secondary`: Match setup modal secondary button style

### 5. Align Modal Container Styling
**Change**: Use same modal container styles (border-radius, padding, shadows).

**Current**: `.onboarding-step__content` has `border-radius: 12px`, `padding: 48px`
**Target**: Match `.onboarding-modal-container` styles (`border-radius: 8px`, consistent padding)

### 6. Align Typography
**Change**: Ensure consistent font families, sizes, and weights.

**Current**: Mix of 'Sora' and 'IBM Plex Sans'
**Target**: Match setup modal typography (titles: 'Sora', body: 'IBM Plex Sans')

## Specific Style Changes Needed

### Button Alignment
```css
/* Current onboarding button */
.onboarding-button--primary {
  background: var(--accent500);
  color: white;
}

/* Should match setup modal button */
.onboarding-button-primary {
  background: #282c34;
  color: #FFFFFF;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Sora', sans-serif;
}

.onboarding-button-primary:hover:not(:disabled),
.onboarding-button-primary:focus:not(:disabled) {
  outline: 2px solid #00BCDC;
  outline-offset: 0;
}
```

### Modal Structure
```tsx
// Current structure
<div className="onboarding-container">
  <div className="onboarding-header">...</div>
  <div className="onboarding-main">
    <div className="onboarding-step__content">...</div>
  </div>
</div>

// Target structure
<div className="onboarding-modal-overlay">
  <div className="onboarding-modal-container">
    <StepIndicator currentStep={currentStep} />
    <div className="onboarding-modal-header">
      <button className="onboarding-back-button">...</button>
      <h2 className="onboarding-modal-title">...</h2>
    </div>
    <div className="onboarding-modal-body">...</div>
    <div className="onboarding-modal-footer">...</div>
  </div>
</div>
```

## Priority Order

1. **High Priority**: Button style alignment (visual consistency)
2. **High Priority**: Modal layout conversion (structural consistency)
3. **Medium Priority**: Step indicator addition (UX consistency)
4. **Medium Priority**: Back button in header (navigation consistency)
5. **Low Priority**: Typography fine-tuning (polish)

## Implementation Notes

- The onboarding modals currently use a `Button` component wrapper, while setup modals use direct button elements with classes
- Consider creating a shared button component or standardizing on one approach
- Step indicator component already exists (`StepIndicator.tsx`) but may need adaptation for onboarding steps
- Modal overlay styles already exist in `onboardingModal.css` and can be reused

