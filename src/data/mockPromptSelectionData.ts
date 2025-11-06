export interface Prompt {
  id: string;
  text: string;
  confidence: number;
  preselected: boolean;
  recommended: boolean;
}

export interface TopicGroup {
  id: string;
  name: string;
  icon: string;
  collapsed: boolean;
  prompts: Prompt[];
}

export const mockPromptSelectionData: TopicGroup[] = [
  {
    id: 'product',
    name: 'Product Features',
    icon: 'Target',
    collapsed: false,
    prompts: [
      {
        id: 'p1',
        text: 'What\'s the best project management tool?',
        confidence: 92,
        preselected: true,
        recommended: true
      },
      {
        id: 'p2',
        text: 'Which task management software has the best features?',
        confidence: 88,
        preselected: true,
        recommended: true
      },
      {
        id: 'p3',
        text: 'What are the top features to look for in a productivity tool?',
        confidence: 85,
        preselected: true,
        recommended: true
      },
      {
        id: 'p4',
        text: 'How do I choose the right collaboration platform?',
        confidence: 78,
        preselected: false,
        recommended: false
      },
      {
        id: 'p5',
        text: 'What project management tools integrate with Slack?',
        confidence: 82,
        preselected: false,
        recommended: false
      },
      {
        id: 'p6',
        text: 'Which productivity apps work best for remote teams?',
        confidence: 90,
        preselected: true,
        recommended: true
      },
      {
        id: 'p7',
        text: 'What are the most important features in team collaboration software?',
        confidence: 86,
        preselected: false,
        recommended: true
      },
      {
        id: 'p8',
        text: 'How to improve team productivity with software tools?',
        confidence: 75,
        preselected: false,
        recommended: false
      }
    ]
  },
  {
    id: 'competitive',
    name: 'Competitive Comparison',
    icon: 'Swords',
    collapsed: false,
    prompts: [
      {
        id: 'c1',
        text: 'Asana vs Monday vs ClickUp: which is better?',
        confidence: 94,
        preselected: true,
        recommended: true
      },
      {
        id: 'c2',
        text: 'What are the main differences between Asana and Trello?',
        confidence: 91,
        preselected: true,
        recommended: true
      },
      {
        id: 'c3',
        text: 'Is Asana better than Jira for agile teams?',
        confidence: 87,
        preselected: true,
        recommended: true
      },
      {
        id: 'c4',
        text: 'Asana vs Notion: which should I choose?',
        confidence: 89,
        preselected: true,
        recommended: true
      },
      {
        id: 'c5',
        text: 'What are alternatives to Asana?',
        confidence: 93,
        preselected: true,
        recommended: true
      },
      {
        id: 'c6',
        text: 'Why should I choose Asana over competitors?',
        confidence: 88,
        preselected: false,
        recommended: true
      },
      {
        id: 'c7',
        text: 'How does Asana compare to Microsoft Project?',
        confidence: 84,
        preselected: false,
        recommended: false
      },
      {
        id: 'c8',
        text: 'Which is more affordable: Asana or Monday?',
        confidence: 86,
        preselected: false,
        recommended: false
      }
    ]
  },
  {
    id: 'industry',
    name: 'Industry & Trends',
    icon: 'ChartBar',
    collapsed: true,
    prompts: [
      {
        id: 'i1',
        text: 'What are the latest trends in project management?',
        confidence: 81,
        preselected: false,
        recommended: false
      },
      {
        id: 'i2',
        text: 'How is AI changing project management software?',
        confidence: 79,
        preselected: false,
        recommended: false
      },
      {
        id: 'i3',
        text: 'What are the most popular project management methodologies?',
        confidence: 83,
        preselected: false,
        recommended: true
      },
      {
        id: 'i4',
        text: 'How has remote work changed project management tools?',
        confidence: 85,
        preselected: false,
        recommended: true
      },
      {
        id: 'i5',
        text: 'What are the future trends in team collaboration?',
        confidence: 77,
        preselected: false,
        recommended: false
      },
      {
        id: 'i6',
        text: 'How do companies improve project success rates?',
        confidence: 80,
        preselected: false,
        recommended: false
      }
    ]
  },
  {
    id: 'pricing',
    name: 'Pricing & Value',
    icon: 'CurrencyDollar',
    collapsed: true,
    prompts: [
      {
        id: 'pr1',
        text: 'What is the best value project management tool?',
        confidence: 87,
        preselected: false,
        recommended: true
      },
      {
        id: 'pr2',
        text: 'How much does Asana cost?',
        confidence: 92,
        preselected: false,
        recommended: true
      },
      {
        id: 'pr3',
        text: 'Is Asana worth the price?',
        confidence: 88,
        preselected: false,
        recommended: false
      },
      {
        id: 'pr4',
        text: 'What are the best free project management tools?',
        confidence: 90,
        preselected: false,
        recommended: true
      },
      {
        id: 'pr5',
        text: 'How to get the most value from project management software?',
        confidence: 76,
        preselected: false,
        recommended: false
      }
    ]
  },
  {
    id: 'use-cases',
    name: 'Use Cases & Solutions',
    icon: 'Bulb',
    collapsed: true,
    prompts: [
      {
        id: 'u1',
        text: 'Best project management tool for small businesses?',
        confidence: 89,
        preselected: false,
        recommended: true
      },
      {
        id: 'u2',
        text: 'What\'s the best tool for marketing teams?',
        confidence: 85,
        preselected: false,
        recommended: true
      },
      {
        id: 'u3',
        text: 'How to manage multiple projects effectively?',
        confidence: 83,
        preselected: false,
        recommended: false
      },
      {
        id: 'u4',
        text: 'Which tool is best for software development teams?',
        confidence: 91,
        preselected: false,
        recommended: true
      },
      {
        id: 'u5',
        text: 'How to improve team communication and collaboration?',
        confidence: 80,
        preselected: false,
        recommended: false
      },
      {
        id: 'u6',
        text: 'Best practices for project management in 2024?',
        confidence: 78,
        preselected: false,
        recommended: false
      }
    ]
  },
  {
    id: 'integration',
    name: 'Integration & Setup',
    icon: 'Link',
    collapsed: true,
    prompts: [
      {
        id: 'int1',
        text: 'How to integrate Asana with other tools?',
        confidence: 84,
        preselected: false,
        recommended: false
      },
      {
        id: 'int2',
        text: 'Does Asana integrate with Google Workspace?',
        confidence: 88,
        preselected: false,
        recommended: true
      },
      {
        id: 'int3',
        text: 'How to set up Asana for a new team?',
        confidence: 81,
        preselected: false,
        recommended: false
      },
      {
        id: 'int4',
        text: 'What are the best integrations for project management?',
        confidence: 86,
        preselected: false,
        recommended: true
      },
      {
        id: 'int5',
        text: 'How to migrate from another tool to Asana?',
        confidence: 79,
        preselected: false,
        recommended: false
      }
    ]
  }
];
