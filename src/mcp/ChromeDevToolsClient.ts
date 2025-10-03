import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport, type StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio';
import { ToolExecutor, type ToolCallResult, type ToolContent } from './types';

const DEFAULT_SERVER_COMMAND = 'npx';
const DEFAULT_SERVER_ARGS = [
  '-y',
  'chrome-devtools-mcp@latest',
  '--headless=true',
  '--isolated=true',
];

export interface ChromeDevToolsClientOptions {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  clientName?: string;
  clientVersion?: string;
}

function buildToolTextContent(content: ToolContent[]): string {
  return content
    .filter((item) => item.type === 'text')
    .map((item) => ('text' in item ? item.text : ''))
    .join('\n');
}

export class ChromeDevToolsClient implements ToolExecutor {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private started = false;
  private readonly options: ChromeDevToolsClientOptions;

  constructor(options: ChromeDevToolsClientOptions = {}) {
    this.options = options;
  }

  async connect(): Promise<void> {
    if (this.started) {
      return;
    }

    const clientName = this.options.clientName ?? 'chrome-devtools-test-agent';
    const clientVersion = this.options.clientVersion ?? '1.0.0';

    this.client = new Client({
      name: clientName,
      version: clientVersion,
    });

    const params: StdioServerParameters = {
      command: this.options.command ?? DEFAULT_SERVER_COMMAND,
      args: this.options.args ?? DEFAULT_SERVER_ARGS,
      stderr: 'pipe',
    };
    if (this.options.env) {
      params.env = this.options.env;
    }
    if (this.options.cwd) {
      params.cwd = this.options.cwd;
    }
    const stdioTransport = new StdioClientTransport(params);
    await stdioTransport.start();
    this.transport = stdioTransport;

    await this.client.connect(this.transport);
    await this.client.listTools({});
    this.started = true;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    if (!this.client || !this.transport) {
      throw new Error('ChromeDevToolsClient is not connected. Call connect() first.');
    }

    const result = await this.client.callTool({
      name,
      arguments: args,
    });

    const content = (result.content ?? []) as ToolContent[];
    const text = buildToolTextContent(content);

    if (result.isError) {
      throw new Error(text || `Tool ${name} reported an error.`);
    }

    return {
      name,
      text,
      isError: Boolean(result.isError),
      content,
      structuredContent: result.structuredContent ?? undefined,
    };
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.client = null;
    this.started = false;
  }
}
