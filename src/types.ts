export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type Message = {
  role: MessageRole | string;
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolPropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: ToolPropertyType; description?: string }>;
      required?: string[];
    };
  };
};

export type AiTestAgentPayload = { messages: Message[]; tools?: unknown[] };

export type Choice = {
  index: number;
  finish_reason: string | null;
  message: { role: string; content: string | null; reasoning?: string | null; tool_calls?: ToolCall[] };
};

export type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number; cost?: number };

export type CompletionResult = { id: string; model: string; choices: Choice[]; usage: Usage };

export type AiTestAgentResult = CompletionResult;

export type ReasoningEffort = 'xhigh' | 'high' | 'medium' | 'low' | 'minimal' | 'none';

export type BatchTask = {
  id: string;
  model: string;
  temperature: number;
  reasoningEffort?: ReasoningEffort;
  maxTokens?: number;
  excluded?: boolean;
};

export type BatchCallResult =
  | { success: true; data: CompletionResult; durationMs: number }
  | { success: false; error: string; durationMs: number };

export type CheckResult = { name: string; pass: boolean; message?: string };

/** @deprecated legacy single-snapshot shape, kept only to migrate old `multipleResults` JSON on read */
export type MultipleResultsState = {
  tasks: BatchTask[];
  callCount: number;
  results: BatchCallResult[][];
  testSuite: string;
};

export type MultipleResultsSnapshot = {
  id: string;
  createdAt: string;
  tasks: BatchTask[];
  callCount: number;
  results: BatchCallResult[][];
};

export type DecisionStateItem = string | { type: 'image_url'; image_url: { url: string } };

export type DecisionQuestion =
  | { type: 'noul'; instructions: string; criteria: { true: string; false: string } }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type DecisionAnswer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; probabilities: Record<string, number> }
  | { type: 'score'; score: string; probabilities: Record<string, number> };

export type DecisionResult = { answers: Record<string, DecisionAnswer>; usage: Usage };

export type DecisionCallResult =
  | { success: true; data: DecisionResult; durationMs: number }
  | { success: false; error: string; durationMs: number };

export type GeneratedImage = { dataUrl: string; mediaType?: string };

export type ImageGenResult = { images: GeneratedImage[]; usage: Usage };

export type ImageGenCallResult =
  | { success: true; data: ImageGenResult; durationMs: number }
  | { success: false; error: string; durationMs: number };

export type ExtractionResult = { data: unknown; usage: Usage };

export type ExtractionCallResult =
  | { success: true; data: ExtractionResult; durationMs: number }
  | { success: false; error: string; durationMs: number };
