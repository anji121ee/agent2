import { TestPlan, TestCase } from '../types';

function renderTestCase(test: TestCase, index: number): string {
  const lines: string[] = [];
  lines.push(`### ${index + 1}. ${test.title}`);
  lines.push(`- **Type:** ${test.type}`);
  lines.push(`- **Risk:** ${test.risk}`);
  lines.push(`- **Objective:** ${test.objective}`);
  if (test.steps.length) {
    lines.push('\n#### Steps');
    test.steps.forEach((step, stepIndex) => {
      lines.push(`${stepIndex + 1}. ${step}`);
    });
  }
  if (test.assertions.length) {
    lines.push('\n#### Assertions');
    test.assertions.forEach((assertion) => {
      lines.push(`- ${assertion}`);
    });
  }
  if (test.relatedElements.length) {
    lines.push('\n#### Related elements');
    lines.push(test.relatedElements.map((el) => `\`${el}\``).join(', '));
  }
  lines.push('');
  return lines.join('\n');
}

export function renderTestPlan(plan: TestPlan): string {
  const sections: string[] = [];
  sections.push(`# Test plan for ${plan.applicationTitle}`);
  sections.push(`- **URL:** ${plan.url}`);
  sections.push(`- **Generated:** ${plan.generatedAt}`);
  sections.push('');
  sections.push('## Summary');
  sections.push(plan.summary);
  sections.push('');
  sections.push('## Key insights');
  plan.keyInsights.forEach((insight) => {
    sections.push(`- ${insight}`);
  });
  sections.push('');
  sections.push('## Recommended tests');
  plan.recommendedTests.forEach((test, index) => {
    sections.push(renderTestCase(test, index));
  });
  sections.push('## Notes');
  if (plan.notes.consoleErrors.length) {
    sections.push('**Console errors:**');
    plan.notes.consoleErrors.forEach((error) => sections.push(`- ${error}`));
  } else {
    sections.push('**Console errors:** none observed.');
  }
  if (plan.notes.consoleWarnings.length) {
    sections.push('\n**Console warnings:**');
    plan.notes.consoleWarnings.forEach((warning) => sections.push(`- ${warning}`));
  }
  if (plan.notes.accessibilityGaps.length) {
    sections.push('\n**Accessibility gaps:**');
    plan.notes.accessibilityGaps.forEach((gap) => sections.push(`- ${gap}`));
  }
  sections.push('');
  return sections.join('\n');
}
