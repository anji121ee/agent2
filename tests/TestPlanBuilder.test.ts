import { describe, expect, it } from 'vitest';

import { ApplicationInspector, parseConsoleSummary, parseDomSnapshot } from '../src/agent/ApplicationInspector';
import { TestPlanBuilder } from '../src/agent/TestPlanBuilder';
import type { InspectionSnapshot } from '../src/types';

const SAMPLE_SNAPSHOT: InspectionSnapshot = {
  url: 'https://example.com',
  capturedAt: '2025-01-01T00:00:00.000Z',
  dom: {
    title: 'Example App',
    metaDescription: 'Example application for testing',
    headings: [
      { level: 'h1', text: 'Welcome to Example App' },
      { level: 'h2', text: 'Contact us' },
    ],
    forms: [
      {
        id: 'contact-form',
        name: 'Contact',
        action: '/contact',
        method: 'post',
        fields: [
          {
            name: 'email',
            type: 'email',
            required: true,
            label: 'Email address',
            placeholder: null,
          },
          {
            name: 'message',
            type: 'textarea',
            required: true,
            label: 'Message',
            placeholder: null,
          },
        ],
        buttons: [
          {
            text: 'Send message',
            type: 'submit',
            role: 'button',
            classes: ['btn', 'btn-primary'],
            dataTestId: 'submit-contact',
          },
        ],
        textualContext: 'Contact our team',
      },
      {
        id: 'login-form',
        name: null,
        action: '/login',
        method: 'post',
        fields: [
          {
            name: 'username',
            type: 'text',
            required: true,
            label: 'Username',
            placeholder: null,
          },
          {
            name: 'password',
            type: 'password',
            required: true,
            label: 'Password',
            placeholder: null,
          },
        ],
        buttons: [
          {
            text: 'Sign in',
            type: 'submit',
            role: 'button',
            classes: ['btn-primary'],
            dataTestId: null,
          },
        ],
        textualContext: 'Sign in to your account',
      },
    ],
    primaryButtons: [
      {
        text: 'Get started',
        type: 'button',
        role: 'button',
        classes: ['btn', 'btn-primary'],
        dataTestId: 'get-started',
      },
    ],
    interactiveElements: [
      {
        text: 'Get started',
        type: 'button',
        role: 'button',
        classes: ['btn', 'btn-primary'],
        dataTestId: 'get-started',
      },
      {
        text: 'View pricing',
        type: 'button',
        role: 'button',
        classes: ['btn-secondary'],
        dataTestId: null,
      },
    ],
    links: [
      { text: 'Pricing', href: 'https://example.com/pricing' },
      { text: 'Docs', href: 'https://example.com/docs' },
    ],
    imagesMissingAlt: 2,
    dataTestIds: ['submit-contact', 'get-started'],
  },
  console: {
    errors: ['Error> main.js:10: ReferenceError: foo is not defined'],
    warnings: ['Warning> app.js:100: Deprecated API used'],
    info: [],
    logs: [],
  },
};

describe('TestPlanBuilder', () => {
  it('creates a comprehensive plan with CTA, form, and accessibility coverage', () => {
    const plan = TestPlanBuilder.build(SAMPLE_SNAPSHOT);
    expect(plan.recommendedTests.length).toBeGreaterThan(4);
    expect(plan.keyInsights).toContain('Authentication flow detected (login/sign-in elements present).');
    expect(plan.notes.consoleErrors).toHaveLength(1);
    const formTest = plan.recommendedTests.find((test) => test.title.includes('Contact'));
    expect(formTest?.steps.some((step) => step.includes('Enter representative email data'))).toBe(true);
    const accessibilityTest = plan.recommendedTests.find((test) => test.type === 'accessibility');
    expect(accessibilityTest).toBeTruthy();
  });
});

describe('ApplicationInspector parsing helpers', () => {
  it('parses evaluate_script output into a DOM snapshot', () => {
    const payload = {
      title: 'Demo',
      metaDescription: 'Demo page',
      headings: [{ level: 'h1', text: 'Demo' }],
      forms: [],
      primaryButtons: [],
      interactiveElements: [],
      links: [],
      imagesMissingAlt: 1,
      dataTestIds: ['cta-btn'],
    };
    const raw = [
      '# evaluate_script response',
      'Script ran on page and returned:',
      '```json',
      JSON.stringify(payload),
      '```',
      '## Pages',
      '0: https://demo.example [selected]',
    ].join('\n');
    const snapshot = parseDomSnapshot(raw);
    expect(snapshot.title).toBe('Demo');
    expect(snapshot.imagesMissingAlt).toBe(1);
    expect(snapshot.dataTestIds).toContain('cta-btn');
  });

  it('parses console responses and categorises severities', () => {
    const rawConsole = [
      '# list_console_messages response',
      '## Console messages',
      'Error> main.js:10: ReferenceError',
      'Warning> app.js:100: Deprecated API used',
      'Log> analytics.js:1: Event fired',
    ].join('\n');
    const summary = parseConsoleSummary(rawConsole);
    expect(summary.errors).toHaveLength(1);
    expect(summary.warnings).toHaveLength(1);
    expect(summary.logs).toHaveLength(1);
  });
});

