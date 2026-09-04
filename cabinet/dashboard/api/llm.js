// Клиент OfoxAI (решение владельца 2026-09-04: модели утверждены, ключ подключён).
// Сеть — только в dashboard/api. Ключ читается из ~/.config/marketing-club/ofox.key
// (вне репозитория; тест выгрузки проверяет, что секреты не попадают в git).
import { existsSync, readFileSync } from '../_shim/node.js';
import { homedir } from '../_shim/node.js';
import { join } from '../_shim/node.js';
                                                
import { DomainError } from '../core/types.js?v=mtmjsdom';

const KEY_PATH = join(homedir(), '.config/marketing-club/ofox.key');
const BASE = 'https://api.ofox.ai/v1/chat/completions';
const TIMEOUT_MS = 90_000;

// Идентификаторы моделей на OfoxAI (каталог ofox.ai/models, снят 2026-09-04).
const OFOX_MODEL                          = {
  'claude-fable-5.1': 'anthropic/claude-fable-5.1',
  'claude-sonnet-5': 'anthropic/claude-sonnet-5',
  'claude-haiku-4.5': 'anthropic/claude-haiku-4.5',
  'gpt-5.6-sol': 'openai/gpt-5.6-sol',
  'gpt-5.6-luna': 'openai/gpt-5.6-luna',
  'gpt-5.6-terra': 'openai/gpt-5.6-terra',
  'gpt-5.4-nano': 'openai/gpt-5.4-nano',
  'gemini-3.7-flash': 'google/gemini-3.7-flash',
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash-0731',
  'glm-5.3-flash': 'z-ai/glm-5.3-flash',
};

// Цены $/1M токенов с учётом скидок Ofox (для честного учёта расходов в лимитах).
const PRICE                                                     = {
  'claude-fable-5.1': { input: 10, output: 50 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4.5': { input: 1, output: 5 },
  'gpt-5.6-sol': { input: 2.5, output: 15 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.6-terra': { input: 2, output: 12 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gemini-3.7-flash': { input: 0.75, output: 3.75 },
  'deepseek-v4-flash': { input: 0.44, output: 1.32 },
  'glm-5.3-flash': { input: 0.075, output: 0.25 },
};

export function llmReady()          {
  try { return existsSync(KEY_PATH) && readFileSync(KEY_PATH, 'utf8').trim().length > 10; } catch { return false; }
}

                                                                                                                     

export async function generateText(model         , system        , user        , maxTokens = 1500)                     {
  const key = readFileSync(KEY_PATH, 'utf8').trim();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res          ;
  try {
    res = await fetch(BASE, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OFOX_MODEL[model], max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
  } catch (e) {
    throw new DomainError('LLM_UNREACHABLE', `Модель недоступна: ${e instanceof Error ? e.message : String(e)}`);
  } finally { clearTimeout(timer); }
  const data      = await res.json().catch(() => null);
  if (!res.ok || !data?.choices?.[0]?.message?.content) {
    throw new DomainError('LLM_ERROR', `Ответ модели ${model}: HTTP ${res.status} ${data?.error?.message ?? ''}`.trim());
  }
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const p = PRICE[model];
  const costUsd = Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 10000) / 10000;
  return { text: String(data.choices[0].message.content), costUsd, model, inputTokens, outputTokens };
}

// Достаёт JSON из ответа модели (модели любят оборачивать в ```json … ```).
export function parseModelJson(text        )             {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}
