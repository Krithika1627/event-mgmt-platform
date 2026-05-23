export interface FileDiff {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
}

export interface ReviewIssue {
  file: string;
  line: number;
  severity: 'critical' | 'warning' | 'info';
  type: 'bug' | 'security' | 'performance' | 'quality' | 'style';
  message: string;
  suggestion: string;
}

export interface ReviewSummary {
  critical: number;
  warning: number;
  info: number;
  overall: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: ReviewSummary;
}
