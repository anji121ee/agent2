# Chrome DevTools MCP Test Agent

This project provides a CLI agent that connects to the [`chrome-devtools-mcp`](https://www.npmjs.com/package/chrome-devtools-mcp) server to inspect a live web application and produce a structured test plan. The agent launches the Chrome DevTools MCP server through the Model Context Protocol SDK, captures high-level page information, and turns the data into actionable test cases.

## Features

- Starts a Chrome DevTools MCP session via `@modelcontextprotocol/sdk`.
- Navigates to the target URL and extracts forms, buttons, headings, and metadata by executing in-page JavaScript.
- Collects console diagnostics and accessibility signals (for example, images missing `alt` text).
- Generates a prioritised test plan that covers smoke, form validation, accessibility, and regression scenarios.
- Renders the resulting plan as Markdown for easy sharing.

> **Note:** Running the CLI requires Chrome to be available in the environment. The default configuration launches Chrome in headless, isolated mode via `npx chrome-devtools-mcp@latest`.

## Getting started

Install dependencies:

```bash
npm install
```

### Running the agent

Build a test plan for a URL:

```bash
npm start -- https://example.com
```

Optional flags:

- `--timeout <ms>` – Override the navigation timeout passed to Chrome DevTools.

The command prints a Markdown report that includes the key insights and a set of recommended manual test cases.

### Testing

Unit tests exercise the plan builder heuristics and the parsing helpers used by the inspector:

```bash
npm test -- --run
```

Vitest is configured to run in single-shot mode when the `--run` flag is present.

## Project structure

```
src/
  agent/
    ApplicationInspector.ts   # Gathers DOM + console details via MCP tools
    TestPlanBuilder.ts        # Converts the inspection snapshot into a test plan
    TestPlanRenderer.ts       # Renders the plan as Markdown
  mcp/
    ChromeDevToolsClient.ts   # Wrapper around the MCP SDK client and transport
    types.ts
  utils/
    slugify.ts
  types.ts                    # Shared domain types
index.ts                      # CLI entry point
```

Automated tests live in `tests/` and focus on deterministic logic that does not require a running Chrome instance.
