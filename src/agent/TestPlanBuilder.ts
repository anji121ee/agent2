import { InspectionSnapshot, TestPlan, TestCase, FormSummary, ButtonSummary, FormFieldSummary } from '../types';
import { slugify } from '../utils/slugify';

function createUniqueId(base: string, used: Set<string>): string {
  const candidate = slugify(base);
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }
  let counter = 2;
  while (used.has(`${candidate}-${counter}`)) {
    counter += 1;
  }
  const finalId = `${candidate}-${counter}`;
  used.add(finalId);
  return finalId;
}

function describeForm(form: FormSummary, index: number): string {
  if (form.name) {
    return form.name;
  }
  if (form.id) {
    return form.id;
  }
  if (form.textualContext) {
    return form.textualContext.slice(0, 50);
  }
  return `Form ${index + 1}`;
}

function chooseRisk(form: FormSummary): 'high' | 'medium' | 'low' {
  const textBlob = `${form.textualContext ?? ''} ${form.buttons.map((btn) => btn.text ?? '').join(' ')}`.toLowerCase();
  if (textBlob.match(/payment|checkout|billing|subscribe|purchase|confirm/i)) {
    return 'high';
  }
  if (textBlob.match(/sign in|login|password|register|profile/i)) {
    return 'high';
  }
  return form.fields.some((field) => field.required) ? 'medium' : 'low';
}

function buildFieldStep(field: FormFieldSummary): string {
  const label = field.label ?? field.placeholder ?? field.name ?? field.type;
  return `Enter representative ${field.type} data into “${label}”.`;
}

function findPrimaryHeading(snapshot: InspectionSnapshot): string | null {
  const heading = snapshot.dom.headings.find((item) => item.level === 'h1') ?? snapshot.dom.headings[0];
  return heading?.text ?? null;
}

function hasKeywordMatch(target: string | null, keywords: string[]): boolean {
  if (!target) {
    return false;
  }
  const lower = target.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function detectJourneys(snapshot: InspectionSnapshot): string[] {
  const journeys: string[] = [];
  if (
    snapshot.dom.forms.some((form) =>
      form.fields.some((field) => field.type.includes('password')) ||
      hasKeywordMatch(form.textualContext, ['login', 'sign in', 'account'])
    )
  ) {
    journeys.push('Authentication flow detected (login/sign-in elements present).');
  }

  const commerceSignals = ['checkout', 'cart', 'payment', 'billing', 'pricing'];
  if (
    snapshot.dom.forms.some((form) => hasKeywordMatch(form.textualContext, commerceSignals)) ||
    snapshot.dom.primaryButtons.some((button) => hasKeywordMatch(button.text, commerceSignals))
  ) {
    journeys.push('Commerce flow indicators found (checkout or payment wording).');
  }

  const searchSignals = ['search', 'find'];
  if (
    snapshot.dom.forms.some((form) =>
      form.fields.some((field) => hasKeywordMatch(field.label, searchSignals) || field.type === 'search')
    )
  ) {
    journeys.push('On-site search capability detected (search input present).');
  }

  if (journeys.length === 0) {
    journeys.push('No specific business-critical journey detected; focus on core smoke coverage.');
  }

  return journeys;
}

function buildCtaTest(button: ButtonSummary, snapshot: InspectionSnapshot, usedIds: Set<string>): TestCase {
  const label = button.text ?? 'primary action';
  const id = createUniqueId(`cta-${label}`, usedIds);
  return {
    id,
    title: `CTA: ${label} directs the user correctly`,
    type: 'functional',
    risk: 'medium',
    objective: `Verify that the prominent “${label}” call-to-action on ${snapshot.dom.title} leads to the expected workflow or page.`,
    steps: [
      `Navigate to ${snapshot.url}.`,
      `Ensure the “${label}” action is visible and enabled.`,
      `Activate the control and follow the resulting navigation or modal flow.`,
    ],
    assertions: [
      'User is taken to the expected destination or sees the correct confirmation.',
      'No blocking console errors or uncaught exceptions occur during the interaction.',
    ],
    relatedElements: button.dataTestId ? [button.dataTestId] : button.classes,
  };
}

function buildFormHappyPathTest(
  form: FormSummary,
  index: number,
  snapshot: InspectionSnapshot,
  usedIds: Set<string>
): TestCase {
  const formName = describeForm(form, index);
  const id = createUniqueId(`submit-${formName}`, usedIds);
  const fieldSteps = form.fields.slice(0, 6).map(buildFieldStep);
  const submitHint = form.buttons.find((button) => hasKeywordMatch(button.text, ['submit', 'save', 'continue', 'sign in', 'sign up']));
  return {
    id,
    title: `Submit “${formName}” with valid data`,
    type: 'functional',
    risk: chooseRisk(form),
    objective: `Confirm that the “${formName}” form accepts valid input and produces the expected success outcome.`,
    steps: [
      `Navigate to ${snapshot.url}.`,
      `Locate the “${formName}” form.`,
      ...fieldSteps,
      submitHint
        ? `Submit the form via the “${submitHint.text ?? submitHint.type}” control.`
        : 'Submit the form using the primary available control.',
    ],
    assertions: [
      'The form submission succeeds (e.g., success message, navigation, or state update).',
      'No validation errors appear for fields populated with valid values.',
      'Network calls triggered by the submission return successful statuses.',
    ],
    relatedElements: [form.id, form.name].filter(Boolean) as string[],
  };
}

function buildFormValidationTest(
  form: FormSummary,
  index: number,
  snapshot: InspectionSnapshot,
  usedIds: Set<string>
): TestCase {
  const formName = describeForm(form, index);
  const id = createUniqueId(`validation-${formName}`, usedIds);
  const requiredFields = form.fields.filter((field) => field.required).map((field) => field.label ?? field.name ?? field.type);
  return {
    id,
    title: `Validation: “${formName}” blocks incomplete submissions`,
    type: 'functional',
    risk: chooseRisk(form),
    objective: `Ensure the “${formName}” form enforces mandatory fields and provides actionable feedback.`,
    steps: [
      `Navigate to ${snapshot.url}.`,
      `Locate the “${formName}” form.`,
      'Leave required fields blank or provide invalid values.',
      'Attempt to submit the form.',
    ],
    assertions: [
      `Validation prevents submission until the following fields are completed: ${requiredFields.join(', ')}.`,
      'Error messaging is visible, accessible, and clearly references each failing field.',
    ],
    relatedElements: [form.id, form.name].filter(Boolean) as string[],
  };
}

function buildAccessibilityTest(snapshot: InspectionSnapshot, usedIds: Set<string>): TestCase {
  const id = createUniqueId('accessibility-review', usedIds);
  return {
    id,
    title: 'Accessibility review: media alternatives and semantics',
    type: 'accessibility',
    risk: snapshot.dom.imagesMissingAlt > 0 ? 'high' : 'medium',
    objective: 'Assess critical accessibility requirements on the page, focusing on images, landmarks, and focus management.',
    steps: [
      `Open ${snapshot.url} and inspect the DOM using accessibility tooling (axe, Lighthouse, or equivalent).`,
      'Evaluate images, interactive controls, and headings for proper semantic structure.',
      'Review keyboard navigation and focus indicators across primary interactions.',
    ],
    assertions: [
      snapshot.dom.imagesMissingAlt > 0
        ? `${snapshot.dom.imagesMissingAlt} image(s) receive descriptive alt text or are explicitly marked as decorative.`
        : 'All meaningful imagery has descriptive alt text or is marked decorative as appropriate.',
      'Interactive elements expose accessible names and roles.',
      'No critical WCAG AA violations are reported.',
    ],
    relatedElements: snapshot.dom.dataTestIds.slice(0, 5),
  };
}

function buildConsoleTest(snapshot: InspectionSnapshot, usedIds: Set<string>): TestCase {
  const sampleError = snapshot.console.errors[0] ?? snapshot.console.warnings[0] ?? 'Console noise detected';
  const id = createUniqueId('monitor-console', usedIds);
  return {
    id,
    title: 'Regression guard: console remains clean on load',
    type: 'regression',
    risk: snapshot.console.errors.length > 0 ? 'high' : 'medium',
    objective: `Prevent regressions by ensuring known issues such as “${sampleError}” are resolved and stay fixed.`,
    steps: [
      `Launch ${snapshot.url} with the browser console open.`,
      'Reload multiple times and interact with critical UI flows.',
      'Capture stack traces or network failures for any console noise.',
    ],
    assertions: [
      'No errors or uncaught exceptions remain in the console.',
      'Warnings are either eliminated or documented with mitigation.',
    ],
    relatedElements: [],
  };
}

export class TestPlanBuilder {
  static build(snapshot: InspectionSnapshot): TestPlan {
    const usedIds = new Set<string>();
    const tests: TestCase[] = [];

    const heading = findPrimaryHeading(snapshot);
    const baseId = createUniqueId('smoke-page-load', usedIds);
    tests.push({
      id: baseId,
      title: 'Smoke: primary content renders without console issues',
      type: 'functional',
      risk: 'medium',
      objective: `Verify that ${snapshot.dom.title} loads successfully and key content is visible.`,
      steps: [
        `Navigate to ${snapshot.url}.`,
        heading ? `Verify heading “${heading}” is rendered within the viewport.` : 'Verify key hero content is visible.',
        'Capture a screenshot for regression tracking.',
      ],
      assertions: [
        'Initial load completes without console errors.',
        heading ? `Primary heading “${heading}” is displayed and readable.` : 'Primary hero section is displayed.',
      ],
      relatedElements: heading ? [heading] : [],
    });

    snapshot.dom.primaryButtons.slice(0, 2).forEach((button) => {
      tests.push(buildCtaTest(button, snapshot, usedIds));
    });

    snapshot.dom.forms.slice(0, 3).forEach((form, index) => {
      tests.push(buildFormHappyPathTest(form, index, snapshot, usedIds));
      if (form.fields.some((field) => field.required)) {
        tests.push(buildFormValidationTest(form, index, snapshot, usedIds));
      }
    });

    if (snapshot.console.errors.length > 0 || snapshot.console.warnings.length > 0) {
      tests.push(buildConsoleTest(snapshot, usedIds));
    }

    tests.push(buildAccessibilityTest(snapshot, usedIds));

    const insights = detectJourneys(snapshot);
    if (snapshot.dom.imagesMissingAlt > 0) {
      insights.push(`${snapshot.dom.imagesMissingAlt} image(s) are missing alt text.`);
    }
    if (snapshot.console.errors.length > 0) {
      insights.push(`Console surfaced ${snapshot.console.errors.length} error(s) that require investigation.`);
    }

    const summaryParts: string[] = [];
    summaryParts.push(`${snapshot.dom.title} contains ${snapshot.dom.forms.length} form(s) and ${snapshot.dom.interactiveElements.length} interactive control(s).`);
    if (snapshot.console.errors.length > 0 || snapshot.console.warnings.length > 0) {
      summaryParts.push(`Console captured ${snapshot.console.errors.length} error(s) and ${snapshot.console.warnings.length} warning(s) during inspection.`);
    } else {
      summaryParts.push('No console errors were observed during inspection.');
    }
    summaryParts.push(`Accessibility scan flagged ${snapshot.dom.imagesMissingAlt} image(s) without alt text.`);

    return {
      url: snapshot.url,
      applicationTitle: snapshot.dom.title,
      summary: summaryParts.join(' '),
      generatedAt: snapshot.capturedAt,
      keyInsights: insights,
      recommendedTests: tests,
      notes: {
        consoleErrors: snapshot.console.errors,
        consoleWarnings: snapshot.console.warnings,
        accessibilityGaps:
          snapshot.dom.imagesMissingAlt > 0
            ? [`${snapshot.dom.imagesMissingAlt} image(s) missing alt attributes.`]
            : [],
      },
    };
  }
}
