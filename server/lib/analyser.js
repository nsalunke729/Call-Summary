import { readFile } from 'fs/promises';
import { join } from 'path';
import { getFreeModels } from './models.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const EMOTIONS = [
  'frustrated', 'satisfied', 'anxious', 'confused', 'urgent',
  'calm', 'distressed', 'grateful', 'hostile', 'neutral',
];

const TOPICS = [
  'vehicle damage', 'liability', 'payment', 'injury', 'policy update',
  'claim status', 'repair', 'third party', 'solicitor', 'property',
  'total loss', 'car hire', 'negotiation', 'policy query',
];

const SYSTEM_PROMPT = `You analyse insurance call summaries and extract structured metadata.

Return ONLY a valid JSON object — no explanation, no markdown, no extra text:
{
  "emotions": [...],
  "topics": [...]
}

emotions — the caller's emotional state during the call. Only use values from this list:
${EMOTIONS.join(', ')}

topics — subjects discussed in the call. Only use values from this list:
${TOPICS.join(', ')}

Use the examples below to understand the expected output format and level of detail.
Include only emotions and topics that are clearly present. Omit anything not evident.`;

const EXAMPLES_DIR = join(process.cwd(), 'bb-hiring-call-summary/examples');
const SELECTED = ['good-1', 'good-3', 'good-4'];

let cachedShots = null;

async function getFewShots() {
  if (cachedShots) return cachedShots;
  cachedShots = await Promise.all(
    SELECTED.map(async (name) => {
      const [summary, analysis] = await Promise.all([
        readFile(join(EXAMPLES_DIR, `${name}-summary.txt`), 'utf8'),
        readFile(join(EXAMPLES_DIR, `${name}-analysis.json`), 'utf8'),
      ]);
      return { summary: summary.trim(), analysis: analysis.trim() };
    })
  );
  return cachedShots;
}

export async function analyseCallSummary(summary) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const fewShots = await getFewShots();

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const { summary: s, analysis: a } of fewShots) {
    messages.push(
      { role: 'user', content: s },
      { role: 'assistant', content: a }
    );
  }
  messages.push({ role: 'user', content: summary });

  const primary = process.env.MODEL;
  const freeModels = await getFreeModels();
  const modelsToTry = primary
    ? [primary, ...freeModels.filter(m => m !== primary)]
    : freeModels;

  let lastError;
  for (const model of modelsToTry) {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'BrightNero Call Analyser',
      },
      body: JSON.stringify({ model, messages }),
    });

    if (res.status === 429 || res.status === 404 || res.status === 400) {
      const text = await res.text();
      lastError = new Error(`OpenRouter analyser error ${res.status} (${model}): ${text}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter analyser error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response from analyser');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in analyser response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      emotions: Array.isArray(parsed.emotions) ? parsed.emotions.filter(e => EMOTIONS.includes(e)) : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics.filter(t => TOPICS.includes(t)) : [],
    };
  }

  throw lastError || new Error('All models rate-limited for analyser. Try again shortly.');
}
