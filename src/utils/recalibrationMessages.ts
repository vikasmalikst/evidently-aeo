/**
 * Copy and messaging constants for recalibration workflow
 */

export const RECALIBRATION_MESSAGES = {
  // One-liner for warning banner
  warningBanner: "These prompt changes will recalibrate your visibility score—we'll mark where this happens in your chart.",
  
  // Expandable explanation
  explanation: {
    title: "Why scores recalibrate",
    paragraph: "Your visibility score reflects how often your brand appears in AI responses to your specific prompts. When you change prompts, you're measuring something slightly different—not because your brand changed, but because the measurement changed. We use a dotted line to show exactly where this happens so you can compare apples to apples.",
    example: {
      title: "Example",
      text: "If you remove questions about competitors, your visibility score might look lower. That's not because you lost visibility—it's because we're not asking about that topic anymore."
    }
  },
  
  // Modal header
  modalHeader: "Your Changes Will Affect Your Scores",
  
  // Success message
  success: {
    title: "Prompts updated!",
    message: "Your new analysis is queued. A dotted line in your chart marks where this configuration change occurs.",
    queueStatus: "Analysis queued",
    processing: "Processing queries across engines...",
    estimatedTime: "Est. time: {minutes} minutes"
  },
  
  // Confidence levels
  confidence: {
    high: "High (similar topic coverage)",
    medium: "Medium (some topic overlap)",
    low: "Low (different topic focus)"
  },
  
  // Change types
  changes: {
    added: "Added",
    removed: "Removed",
    edited: "Edited"
  }
} as const;

