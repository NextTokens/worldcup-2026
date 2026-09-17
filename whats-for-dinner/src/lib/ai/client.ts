import 'server-only';
import OpenAI from 'openai';

/**
 * OpenAI access. The app is designed to stay useful without a key — every
 * caller falls back to the local ranker — so this returns null rather than
 * throwing when the key is absent.
 */

const globalForAi = globalThis as unknown as { __wfdOpenAI?: OpenAI };

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!globalForAi.__wfdOpenAI) {
    globalForAi.__wfdOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS ?? 45_000),
      maxRetries: 2,
    });
  }
  return globalForAi.__wfdOpenAI;
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}

/**
 * One structured-output call. Returns null on any failure so the caller can
 * degrade to the local result instead of showing the family an error.
 */
export async function askJson<T>(args: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<T | null> {
  const client = getOpenAI();
  if (!client) return null;

  try {
    const res = await client.chat.completions.create({
      model: aiModel(),
      temperature: args.temperature ?? 0.7,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: args.schemaName, strict: true, schema: args.schema },
      },
    });
    const text = res.choices[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('[ai] request failed, falling back to local logic:', err);
    return null;
  }
}
