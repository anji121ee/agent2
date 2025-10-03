export type ToolContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

export interface ToolCallResult {
  name: string;
  text: string;
  isError: boolean;
  content: ToolContent[];
  structuredContent?: unknown;
}

export interface ToolExecutor {
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
}
