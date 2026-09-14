export interface AIContext {
  organizationId: string;
  userId: string;
  role: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string; // used for tool calls
  toolCalls?: any[]; // optional for function calls
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
}

export interface LLMProvider {
  /**
   * Generates a completion from the LLM given a conversation history.
   */
  generateCompletion(
    context: AIContext,
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ message: ChatMessage }>;

  /**
   * Generates a structured output from the LLM, validated against a Zod schema.
   * Used by AIQualificationLayer and other structured-output consumers.
   * Optional — implementations that do not support structured output may omit this.
   */
  generateStructuredOutput?<T>(
    context: AIContext,
    messages: ChatMessage[],
    schema: import('zod').ZodType<T>,
    schemaName?: string
  ): Promise<T>;
}
