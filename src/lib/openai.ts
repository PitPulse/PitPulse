/**
 * Lightweight OpenAI Chat Completions client using fetch (no SDK required).
 *
 * GPT-5 series models are reasoning models. They do NOT support:
 *   temperature, top_p, presence_penalty, frequency_penalty,
 *   logprobs, top_logprobs, logit_bias, max_tokens (legacy).
 *
 * They DO support:
 *   max_completion_tokens, reasoning_effort, tools, structured outputs.
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export type OpenAIChatOptions = {
  model?: string;
  messages: OpenAIMessage[];
  /** Maps to max_completion_tokens in the API. */
  max_tokens?: number;
  /** Controls how much reasoning the model does. Defaults to "medium". */
  reasoning_effort?: ReasoningEffort;
};

type OpenAIChatResponse = {
  output_text?: string | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string | null;
    }>;
    text?: string | null;
  }>;
  choices?: Array<{
    message: {
      role: string;
      content:
        | string
        | Array<{
            type?: string;
            text?: string | null;
          }>
        | null;
      refusal?: string | null;
    };
    finish_reason: string;
  }>;
};

function normalizeText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function joinTextParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const chunks: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const text = part.trim();
      if (text) chunks.push(text);
      continue;
    }
    if (!part || typeof part !== "object") continue;
    const candidate = (part as { text?: unknown }).text;
    if (typeof candidate === "string") {
      const text = candidate.trim();
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n").trim();
}

/**
 * Calls the OpenAI Chat Completions API and returns the assistant's text.
 * Throws on HTTP errors or empty responses.
 */
export async function chatCompletion(
  apiKey: string,
  options: OpenAIChatOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    model: options.model ?? "gpt-5-mini",
    messages: options.messages,
  };

  if (options.max_tokens !== undefined) {
    body.max_completion_tokens = options.max_tokens;
  }
  if (options.reasoning_effort !== undefined) {
    body.reasoning_effort = options.reasoning_effort;
  }

  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as OpenAIChatResponse;
  const firstChoice = data.choices?.[0];

  const fromChoiceContent =
    normalizeText(firstChoice?.message?.content) ||
    joinTextParts(firstChoice?.message?.content);

  const fromChoiceRefusal = normalizeText(firstChoice?.message?.refusal);
  const fromOutputText = normalizeText(data.output_text);

  // Handle output array - GPT-5 models may return output[] with either
  // nested content arrays or direct text fields on message-type items
  let fromOutputArray = "";
  if (Array.isArray(data.output)) {
    const parts: string[] = [];
    for (const item of data.output) {
      if (!item || typeof item !== "object") continue;
      // Direct text field on the output item
      const directText = normalizeText(item.text);
      if (directText) {
        parts.push(directText);
        continue;
      }
      // Nested content array
      const nested = joinTextParts(item.content);
      if (nested) parts.push(nested);
    }
    fromOutputArray = parts.join("\n").trim();
  }

  const text =
    fromChoiceContent || fromChoiceRefusal || fromOutputText || fromOutputArray;

  if (!text) {
    const finishReason = firstChoice?.finish_reason ?? "unknown";
    throw new Error(`No text response from OpenAI (finish_reason: ${finishReason})`);
  }

  return text;
}
