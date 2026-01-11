export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  score: number; // 0-100
  message: string;
  details?: Record<string, unknown>;
  documentationUrl?: string;
}

export interface CategoryResult {
  score: number;
  weight: number;
  tests: TestResult[];
  recommendations: string[];
}

export interface BotAccessStatus {
  botName: string;
  userAgent: string;
  httpStatus: number | null;
  allowed: boolean;
  allowedInRobotsTxt: boolean;
  message: string;
}

export interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedElements: number;
  recommendation: string;
  estimatedFixTime: string;
  helpUrl?: string;
}

export interface AuditMetadata {
  auditTrigger: 'manual' | 'scheduled' | 'onboarding';
  createdBy?: string;
  executionTimeMs: number;
}

export interface AeoAuditResult {
  id?: string;
  brandId: string;
  domain: string;
  timestamp: string;
  overallScore: number;
  scoreBreakdown: {
    technicalCrawlability: number;
    contentQuality: number;
    semanticStructure: number;
    accessibilityAndBrand: number;
    aeoOptimization: number;
  };
  detailedResults: {
    technicalCrawlability: CategoryResult;
    contentQuality: CategoryResult;
    semanticStructure: CategoryResult;
    accessibilityAndBrand: CategoryResult;
    aeoOptimization: CategoryResult;
  };
  botAccessStatus: BotAccessStatus[];
  criticalIssues: Issue[];
  improvementPriorities: string[];
  metadata: AuditMetadata;
}

export interface AnalyzerOptions {
  timeout?: number;
  html?: string;
  brandName?: string;
}
