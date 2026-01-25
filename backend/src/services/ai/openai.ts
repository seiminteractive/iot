import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface OpenAIChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface OpenAIResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
}

export async function callOpenAIJson(args: {
  model: string;
  messages: OpenAIChatMessage[];
  maxOutputTokens: number;
  temperature?: number;
}): Promise<OpenAIResult> {
  if (!config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const res = await fetch(`${config.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.2,
      max_tokens: args.maxOutputTokens,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ status: res.status, text }, 'OpenAI call failed');
    throw new Error(`OpenAI error: ${res.status}`);
  }

  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  const usage = json?.usage || {};
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI returned empty content');
  }

  return {
    content,
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens: usage.total_tokens ?? 0,
    model: json?.model ?? args.model,
  };
}

