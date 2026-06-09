import { readFile } from 'fs/promises';
import { join } from 'path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.MODEL || 'anthropic/claude-opus-4-8';

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

emotions — the caller's emotional state. Only include values from this list:
${EMOTIONS.join(', ')}

topics — subjects discussed in the call. Only include values from this list:
${TOPICS.join(', ')}

Include only emotions and topics that are clearly present. Omit anything not evident.`;

export async function analyseCallSummary(summary) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'BrightNero Call Analyser',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: summary },
      ],
    }),
  });

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
