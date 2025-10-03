export interface ButtonSummary {
  text: string | null;
  type: string;
  role: string;
  classes: string[];
  dataTestId: string | null;
}

export interface FormFieldSummary {
  name: string | null;
  type: string;
  required: boolean;
  label: string | null;
  placeholder: string | null;
}

export interface FormSummary {
  id: string | null;
  name: string | null;
  action: string | null;
  method: string;
  fields: FormFieldSummary[];
  buttons: ButtonSummary[];
  textualContext: string | null;
}

export interface HeadingSummary {
  level: string;
  text: string;
}

export interface LinkSummary {
  text: string | null;
  href: string;
}

export interface DomSnapshot {
  title: string;
  metaDescription: string | null;
  headings: HeadingSummary[];
  forms: FormSummary[];
  primaryButtons: ButtonSummary[];
  interactiveElements: ButtonSummary[];
  links: LinkSummary[];
  imagesMissingAlt: number;
  dataTestIds: string[];
}

export interface ConsoleSummary {
  errors: string[];
  warnings: string[];
  info: string[];
  logs: string[];
}

export interface InspectionSnapshot {
  url: string;
  capturedAt: string;
  dom: DomSnapshot;
  console: ConsoleSummary;
}

export type TestCaseType =
  | 'functional'
  | 'accessibility'
  | 'regression'
  | 'performance'
  | 'exploratory';

export type TestCaseRisk = 'high' | 'medium' | 'low';

export interface TestCase {
  id: string;
  title: string;
  type: TestCaseType;
  risk: TestCaseRisk;
  objective: string;
  steps: string[];
  assertions: string[];
  relatedElements: string[];
}

export interface TestPlan {
  url: string;
  applicationTitle: string;
  summary: string;
  generatedAt: string;
  keyInsights: string[];
  recommendedTests: TestCase[];
  notes: {
    consoleErrors: string[];
    consoleWarnings: string[];
    accessibilityGaps: string[];
  };
}
