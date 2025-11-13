# Prompt Configuration Workflow

A progressive disclosure component system for managing prompt configurations with impact preview and recalibration warnings.

## Features

- **Layer 1**: Inline configuration panel with current metrics and prompt editor
- **Layer 2**: Expandable explanation of recalibration
- **Layer 3**: Impact preview modal with before/after comparison
- **Layer 4**: Success state with analysis queue status

## Usage

```tsx
import { PromptConfigurationWorkflow } from '@/components/PromptConfiguration';
import type { CurrentConfiguration } from '@/hooks/usePromptConfiguration';

const initialConfig: CurrentConfiguration = {
  prompts: [
    {
      id: 1,
      text: "What are the best project management tools?",
      topic: "Product Features",
      type: "system",
      isSelected: true
    },
    // ... more prompts
  ],
  coverage: 94,
  visibilityScore: 72.4,
  lastUpdated: "2024-11-08"
};

function MyComponent() {
  return (
    <PromptConfigurationWorkflow
      initialConfig={initialConfig}
      onViewChart={() => {
        // Navigate to chart view
      }}
    />
  );
}
```

## Component Structure

```
PromptConfigurationWorkflow (main container)
├── PromptConfigPanel (Layer 1)
│   ├── CurrentConfigSummary
│   ├── PromptEditor
│   ├── RecalibrationWarning
│   └── PendingChangesIndicator
├── ImpactPreviewModal (Layer 2/3)
│   ├── ConfigurationComparison
│   ├── ScoreDeltaVisualization
│   └── ChartPreview
└── RecalibrationSuccessState (Layer 4)
```

## Hooks

- `usePromptConfiguration`: Manages prompt state and changes
- `useImpactCalculation`: Calculates score impact of changes
- `useRecalibrationLogic`: Manages modal and submission state

## Utilities

- `impactCalculator`: Calculates estimated impact
- `promptValidator`: Validates prompt changes
- `recalibrationMessages`: Copy and messaging constants

## Design Tokens

Uses CSS variables from the design system:
- `--text-headings`: #1A1D29 (navy)
- `--accent-primary`: #00BCDC (cyan)
- `--text-body`: #393E51
- `--text-caption`: #64748B
- `--border-default`: #E8E9ED
- `--bg-secondary`: #F9F9FB

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- ARIA labels for interactive elements
- Focus management in modals

