const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 60 * 60 * 1000; // refresh every hour

const HARDCODED_FALLBACKS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen3-8b:free',
  'mistralai/mistral-7b-instruct:free',
];

let _cache = null;
let _cacheAt = 0;

export async function getFreeModels() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const res = await fetch(MODELS_URL, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`OpenRouter models API returned ${res.status}`);

    const { data } = await res.json();

    const free = data
      .filter(m => m.id.endsWith(':free') && parseFloat(m.pricing?.prompt ?? '1') === 0)
      .map(m => m.id);

    if (free.length === 0) throw new Error('No free models found in API response');

    _cache = free;
    _cacheAt = Date.now();
    return free;
  } catch {
    return HARDCODED_FALLBACKS;
  }
}
