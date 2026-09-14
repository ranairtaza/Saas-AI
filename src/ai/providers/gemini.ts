import { LLMProvider, ChatMessage, AIContext, CompletionOptions } from './provider';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export class GeminiProvider implements LLMProvider {
  async generateCompletion(
    context: AIContext,
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<{ message: ChatMessage }> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        message: {
          role: 'assistant',
          content:
            'Executive AI Assistant is operating in baseline telemetry mode. Continuous business monitoring, anomaly detection, predictive forecasting, and human approval gates are active. To enable conversational generative reasoning, configure your Gemini API key under environment settings.',
        },
      };
    }

    try {
      const systemMsg = messages.find((m) => m.role === 'system');
      const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

      const conversationHistory = nonSystemMsgs.map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content || '',
      }));

      const { text } = await generateText({
        model: google('gemini-1.5-flash-latest'),
        system: systemMsg?.content,
        messages: conversationHistory,
        temperature: options?.temperature ?? 0.3,
      });

      return {
        message: {
          role: 'assistant',
          content: text,
        },
      };
    } catch (err: any) {
      console.error('[GeminiProvider] Error calling Gemini API:', err);
      return {
        message: {
          role: 'assistant',
          content:
            'Executive AI Assistant encountered a temporary connectivity issue reaching the model endpoint. Your business telemetry, metrics, and pending actions remain secure and unaffected.',
        },
      };
    }
  }
}
