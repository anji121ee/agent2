#!/usr/bin/env node
import process from 'node:process';

import { ApplicationInspector } from './agent/ApplicationInspector';
import { TestPlanBuilder } from './agent/TestPlanBuilder';
import { renderTestPlan } from './agent/TestPlanRenderer';
import { ChromeDevToolsClient } from './mcp/ChromeDevToolsClient';

interface CliOptions {
  url: string | null;
  timeout?: number;
}

function parseArgs(argv: string[]): CliOptions {
  let url: string | null = null;
  let timeout: number | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === undefined) {
      continue;
    }
    if (value === '--timeout' || value === '-t') {
      const next = argv[index + 1];
      if (next === undefined) {
        throw new Error('Missing value for --timeout option.');
      }
      const parsedTimeout = Number.parseInt(next, 10);
      if (Number.isNaN(parsedTimeout)) {
        throw new Error(`Invalid timeout value: ${next}`);
      }
      timeout = parsedTimeout;
      index += 1;
    } else if (!value.startsWith('-') && url === null) {
      url = value;
    }
  }
  const result: CliOptions = { url };
  if (timeout !== undefined) {
    result.timeout = timeout;
  }
  return result;
}

async function main(): Promise<void> {
  const { url, timeout } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error('Usage: npm start -- <url> [--timeout <ms>]');
    process.exitCode = 1;
    return;
  }

  const client = new ChromeDevToolsClient();
  await client.connect();
  try {
    const inspectorOptions = timeout !== undefined ? { navigationTimeoutMs: timeout } : undefined;
    const inspector = new ApplicationInspector(client, inspectorOptions);
    const snapshot = await inspector.inspect(url);
    const plan = TestPlanBuilder.build(snapshot);
    const markdown = renderTestPlan(plan);
    console.log(markdown);
  } catch (error) {
    console.error('Failed to generate test plan:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.close().catch(() => {
      // Ignore close errors
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
