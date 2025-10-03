import { ToolExecutor } from '../mcp/types';
import type { DomSnapshot, ConsoleSummary, InspectionSnapshot, FormSummary, ButtonSummary, FormFieldSummary, HeadingSummary, LinkSummary } from '../types';

const DOM_EXTRACTION_FUNCTION = String.raw`() => {
  const clean = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text || null;
  };

  const asArray = (collection) => Array.from(collection ?? []);

  const readDataId = (element) =>
    element.getAttribute('data-testid') ||
    element.getAttribute('data-test') ||
    element.getAttribute('data-cy') ||
    null;

  const readClasses = (element) =>
    asArray((element.getAttribute('class') || '').split(/\s+/).filter(Boolean));

  const labelFromElement = (element) => {
    if (!element) {
      return null;
    }
    return clean(element.textContent);
  };

  const ariaLabel = (element) => {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labels = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .map(labelFromElement)
        .filter(Boolean);
      if (labels.length) {
        return labels.join(' ');
      }
    }
    return clean(element.getAttribute('aria-label'));
  };

  const summariseButton = (element) => {
    const tag = element.tagName.toLowerCase();
    const type = clean(element.getAttribute('type')) || tag;
    const textSource =
      tag === 'input'
        ? element.getAttribute('value') || element.getAttribute('aria-label')
        : element.textContent;
    return {
      text: clean(textSource),
      type: type,
      role: clean(element.getAttribute('role')) || 'button',
      classes: readClasses(element),
      dataTestId: readDataId(element),
    };
  };

  const summariseFormField = (element) => {
    const tag = element.tagName.toLowerCase();
    const type = clean(element.getAttribute('type')) || tag;
    const labelled = element.labels && element.labels.length
      ? labelFromElement(element.labels[0])
      : ariaLabel(element);
    const placeholder = clean(element.getAttribute('placeholder'));
    return {
      name: clean(element.getAttribute('name')),
      type: type,
      required: element.hasAttribute('required'),
      label: labelled || placeholder,
      placeholder,
    };
  };

  const forms = asArray(document.querySelectorAll('form')).map((form) => ({
    id: clean(form.id),
    name: clean(form.getAttribute('name')),
    action: clean(form.getAttribute('action')),
    method: clean(form.getAttribute('method')) || 'get',
    textualContext: clean(form.textContent),
    fields: asArray(form.querySelectorAll('input, select, textarea')).map(summariseFormField),
    buttons: asArray(
      form.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"]')
    ).map(summariseButton),
  }));

  const buttonElements = asArray(
    document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"], [role="button"]')
  );

  const interactiveElements = buttonElements.map(summariseButton);

  const primaryButtons = interactiveElements.filter((button) => {
    const text = (button.text || '').toLowerCase();
    const classString = button.classes.join(' ').toLowerCase();
    const classKeywords = ['primary', 'cta', 'submit', 'confirm', 'continue', 'start'];
    if (classKeywords.some((keyword) => classString.includes(keyword))) {
      return true;
    }
    const textKeywords = [
      'sign up',
      'sign in',
      'buy',
      'checkout',
      'add to cart',
      'get started',
      'start',
      'continue',
      'book',
      'download',
    ];
    return textKeywords.some((keyword) => text.includes(keyword));
  });

  const links = asArray(document.querySelectorAll('a[href]'))
    .slice(0, 50)
    .map((link) => ({
      text: clean(link.textContent),
      href: clean(link.href) || '',
    }));

  const headings = asArray(document.querySelectorAll('h1, h2, h3')).map((heading) => ({
    level: heading.tagName.toLowerCase(),
    text: clean(heading.textContent) || '',
  }));

  const dataTestIds = asArray(
    document.querySelectorAll('[data-testid], [data-test], [data-cy]')
  )
    .map(readDataId)
    .filter(Boolean);

  return {
    title: clean(document.title) || 'Untitled',
    metaDescription: clean(
      document.querySelector('meta[name="description"]')?.getAttribute('content')
    ),
    headings,
    forms,
    primaryButtons,
    interactiveElements,
    links,
    imagesMissingAlt: document.querySelectorAll('img:not([alt]), img[alt=""]').length,
    dataTestIds: Array.from(new Set(dataTestIds)),
  };
}
`;

function extractJsonPayload(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match || match[1] === undefined) {
    throw new Error('Unable to find JSON payload in evaluate_script response.');
  }
  const [, jsonText] = match;
  return JSON.parse(jsonText);
}

function toStringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function normaliseBoolean(value: unknown): boolean {
  return Boolean(value);
}

function mapFormField(raw: any): FormFieldSummary {
  return {
    name: toStringOrNull(raw?.name),
    type: toStringOrNull(raw?.type) ?? 'input',
    required: normaliseBoolean(raw?.required),
    label: toStringOrNull(raw?.label),
    placeholder: toStringOrNull(raw?.placeholder),
  };
}

function mapButton(raw: any): ButtonSummary {
  const classes = Array.isArray(raw?.classes)
    ? (raw.classes as unknown[])
        .map((item) => toStringOrNull(item))
        .filter((item): item is string => Boolean(item))
    : [];
  return {
    text: toStringOrNull(raw?.text),
    type: toStringOrNull(raw?.type) ?? 'button',
    role: toStringOrNull(raw?.role) ?? 'button',
    classes,
    dataTestId: toStringOrNull(raw?.dataTestId),
  };
}

function mapForm(raw: any): FormSummary {
  const fields = Array.isArray(raw?.fields) ? raw.fields.map(mapFormField) : [];
  const buttons = Array.isArray(raw?.buttons) ? raw.buttons.map(mapButton) : [];
  return {
    id: toStringOrNull(raw?.id),
    name: toStringOrNull(raw?.name),
    action: toStringOrNull(raw?.action),
    method: (toStringOrNull(raw?.method) ?? 'get').toLowerCase(),
    fields,
    buttons,
    textualContext: toStringOrNull(raw?.textualContext),
  };
}

function mapHeading(raw: any): HeadingSummary {
  return {
    level: toStringOrNull(raw?.level) ?? 'h1',
    text: toStringOrNull(raw?.text) ?? '',
  };
}

function mapLink(raw: any): LinkSummary {
  return {
    text: toStringOrNull(raw?.text),
    href: toStringOrNull(raw?.href) ?? '',
  };
}

export function parseDomSnapshot(text: string): DomSnapshot {
  const payload = extractJsonPayload(text) as any;
  const forms = Array.isArray(payload?.forms) ? payload.forms.map(mapForm) : [];
  const primaryButtons = Array.isArray(payload?.primaryButtons)
    ? payload.primaryButtons.map(mapButton)
    : [];
  const interactiveElements = Array.isArray(payload?.interactiveElements)
    ? payload.interactiveElements.map(mapButton)
    : [];
  const headings = Array.isArray(payload?.headings) ? payload.headings.map(mapHeading) : [];
  const links = Array.isArray(payload?.links) ? payload.links.map(mapLink) : [];
  const dataTestIds = Array.isArray(payload?.dataTestIds)
    ? Array.from(
        new Set(
          (payload.dataTestIds as unknown[])
            .map((item) => toStringOrNull(item))
            .filter((item): item is string => typeof item === 'string' && item.length > 0)
        )
      )
    : [];

  return {
    title: toStringOrNull(payload?.title) ?? 'Untitled',
    metaDescription: toStringOrNull(payload?.metaDescription),
    headings,
    forms,
    primaryButtons,
    interactiveElements,
    links,
    imagesMissingAlt: Number.isFinite(payload?.imagesMissingAlt)
      ? Number(payload.imagesMissingAlt)
      : 0,
    dataTestIds,
  };
}

function parseConsoleSection(text: string): string[] {
  const marker = '## Console messages';
  const startIndex = text.indexOf(marker);
  if (startIndex === -1) {
    return [];
  }
  const after = text.slice(startIndex + marker.length);
  const nextHeaderIndex = after.search(/\n#{1,6}\s/);
  const section = nextHeaderIndex === -1 ? after : after.slice(0, nextHeaderIndex);
  return section
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('## '));
}

export function parseConsoleSummary(text: string): ConsoleSummary {
  const messages = parseConsoleSection(text);
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];
  const logs: string[] = [];

  for (const message of messages) {
    const normalized = message.toLowerCase();
    if (normalized.startsWith('error>') || normalized.startsWith('exception>')) {
      errors.push(message);
    } else if (normalized.startsWith('warning>')) {
      warnings.push(message);
    } else if (normalized.startsWith('info>')) {
      info.push(message);
    } else if (normalized === '<no console messages found>') {
      // Ignore placeholder line
    } else {
      logs.push(message);
    }
  }

  return { errors, warnings, info, logs };
}

export interface ApplicationInspectorOptions {
  navigationTimeoutMs?: number;
}

export class ApplicationInspector {
  constructor(
    private readonly tools: ToolExecutor,
    private readonly options: ApplicationInspectorOptions = {}
  ) {}

  async inspect(url: string): Promise<InspectionSnapshot> {
    const timeout = this.options.navigationTimeoutMs ?? 60_000;
    await this.tools.callTool('navigate_page', { url, timeout });
    const domResult = await this.tools.callTool('evaluate_script', {
      function: DOM_EXTRACTION_FUNCTION,
    });
    const consoleResult = await this.tools.callTool('list_console_messages');

    const dom = parseDomSnapshot(domResult.text);
    const console = parseConsoleSummary(consoleResult.text);

    return {
      url,
      capturedAt: new Date().toISOString(),
      dom,
      console,
    };
  }
}
