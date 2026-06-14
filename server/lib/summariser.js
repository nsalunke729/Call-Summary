import { getFewShots } from './examples.js';
import { analyseCallSummary } from './analyser.js';
import { saveCallSummary } from './db.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_CHARS = 1500;

const MODEL_FALLBACKS = [
  process.env.MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen3-8b:free',
  'qwen/qwen3-4b:free',
  'mistralai/mistral-7b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-8b:free',
  'microsoft/phi-3-mini-128k-instruct:free',
];

const SYSTEM_PROMPT = `You are an expert insurance claims handler. Your task is to write a concise, accurate CRM call note from an insurance call transcript.

OUTPUT FORMAT — follow this exactly:

Caller: [Name if known], [relationship: policyholder / third party / third party solicitor / insurance representative / family member / etc.], [inbound or outbound]

Subject:
[Single line describing the call purpose]

Executive Summary:
[One paragraph capturing WHAT happened, WHY the caller reached out, and the caller's emotional state where relevant (e.g. distressed, satisfied, frustrated). Prioritise facts over filler.]
- [Key fact — include specific values: reference numbers, dates, amounts, names, IBANs]
- [Key fact]
- [Additional bullets only if genuinely needed — do not pad]

Next Steps:
[Company name]: [Concrete action with owner and deadline if discussed, or "None"]
Other: [Action required by other parties, or "None"]

CONDITIONAL SECTIONS — include ONLY if that topic was actually discussed on this call. Omit the section header entirely if not mentioned. Use this order when present:

Liability Summary:
[Positions of each party; any admissions or denials; split liability % if agreed]

Negotiation Summary:
[Offer made, counter-offer, agreed settlement or current position]

Vehicle Damage:
Vehicle Status: [drivable / written off / at garage / etc.]
Towage: [details or "None"]
Car hire: [details or "None"]

Injury:
Treatment: [injuries reported, medical attention sought, prognosis if mentioned]

Property:
[property damage details and valuation if discussed]

QUALITY RULES:
1. Identify the caller role precisely — policyholder, third-party solicitor, insurer rep, family member, or other. Do not guess; infer from context clues in the transcript (who they say they represent, who they ask about, policy references they cite).
2. Every specific value (claim number, date, amount, IBAN, email, registration, policy number) must be transcribed exactly as spoken — never paraphrase or approximate.
3. The Executive Summary paragraph must answer: who called, why, and what was resolved or left outstanding. A colleague reading only this paragraph should understand the call.
4. Professional, neutral tone — suitable for sharing with the policyholder if asked.
5. Total output must be ≤ ${MAX_CHARS} characters.

TRANSCRIPT QUALITY — these transcripts come from speech-to-text and may contain:
- Encoding artifacts: â€¦ or â€™ are UTF-8 corruption — treat as a pause or ellipsis, do not include in the summary
- Garbled words: use surrounding context to infer the correct term (e.g. "eye ban" → IBAN, "reg" → vehicle registration, "clame" → claim)
- Fragmented sentences and filler words (um, uh, like, you know) — extract the underlying intent, ignore the filler
- Unclear speaker attribution — infer who is speaking from context (who holds the policy, who called whom, who is asking questions)

COMMON ERRORS TO AVOID:
- Labelling a third-party solicitor, insurer rep, or garage as "customer" or "policyholder"
- Getting the caller's company name wrong (take it directly from what the caller states — do not infer from the claim)
- Stating something was confirmed, agreed, promised, or waived when the transcript is ambiguous or silent on it
- Including Liability / Negotiation / Vehicle Damage / Injury / Property sections when those topics were NOT discussed — never write "None" for an omitted section, omit the heading entirely
- Repeating the same fact in the paragraph and in a bullet point
- Misidentifying who insures whom (especially in dog/animal incidents, dual-insurance, or fleet scenarios)
- Misidentified facts: transcribe reference numbers, email addresses, phone numbers, IBANs, and names exactly as spoken — do not paraphrase or guess
- Missing critical details: if an IBAN, callback phone number, email address, or settlement waiver was discussed, it must appear in the summary
- Omitting promised next steps: if an agent committed to a callback or follow-up action, it must appear in Next Steps

Output only the summary. No preamble, no explanation, no markdown formatting.`;

export class Summariser {
  async summarise(transcript) {
    const fewShots = await getFewShots();
    const messages = this._buildMessages(fewShots, transcript);

    const start = Date.now();
    let { content: summary, model } = await this._callLLM(messages);
    summary = summary.trim();

    if (summary.length > MAX_CHARS) {
      messages.push(
        { role: 'assistant', content: summary },
        {
          role: 'user',
          content: `Your response was ${summary.length} characters. Revise it to stay within ${MAX_CHARS} characters without omitting critical facts.`,
        }
      );
      ({ content: summary } = await this._callLLM(messages));
      summary = summary.trim();
    }

    const { emotions, topics } = await analyseCallSummary(summary);

    let savedId = null;
    try {
      const saved = await saveCallSummary({
        transcript, summary, characterCount: summary.length,
        emotions, topics, model, latencyMs: Date.now() - start,
      });
      savedId = saved?.id ?? null;
    } catch (err) {
      console.error('DB save failed (non-fatal):', err.message);
    }

    return {
      id: savedId,
      summary,
      characterCount: summary.length,
      emotions,
      topics,
      model,
      latencyMs: Date.now() - start,
    };
  }

  async summariseStream(transcript, onChunk, onAnalysing) {
    const fewShots = await getFewShots();
    const messages = this._buildMessages(fewShots, transcript);

    const start = Date.now();
    let { content: summary, model } = await this._callLLMStream(messages, onChunk);
    summary = summary.trim();

    if (summary.length > MAX_CHARS) {
      messages.push(
        { role: 'assistant', content: summary },
        {
          role: 'user',
          content: `Your response was ${summary.length} characters. Revise it to stay within ${MAX_CHARS} characters without omitting critical facts.`,
        }
      );
      ({ content: summary } = await this._callLLM(messages));
      summary = summary.trim();
    }

    if (onAnalysing) onAnalysing();

    const { emotions, topics } = await analyseCallSummary(summary);

    let savedId = null;
    try {
      const saved = await saveCallSummary({
        transcript, summary, characterCount: summary.length,
        emotions, topics, model, latencyMs: Date.now() - start,
      });
      savedId = saved?.id ?? null;
    } catch (err) {
      console.error('DB save failed (non-fatal):', err.message);
    }

    return {
      id: savedId,
      summary,
      characterCount: summary.length,
      emotions,
      topics,
      model,
      latencyMs: Date.now() - start,
    };
  }

  _buildMessages(fewShots, transcript) {
    // System prompt uses a content block so Anthropic prompt caching can be applied
    const messages = [{
      role: 'system',
      content: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    }];

    fewShots.forEach(({ transcript: t, summary: s }, i) => {
      const isLast = i === fewShots.length - 1;
      // Cache the last few-shot assistant turn — everything before the live transcript is static
      messages.push(
        { role: 'user', content: t },
        {
          role: 'assistant',
          content: isLast
            ? [{ type: 'text', text: s, cache_control: { type: 'ephemeral' } }]
            : s,
        }
      );
    });

    messages.push({ role: 'user', content: transcript });
    return messages;
  }

  async _callLLMStream(messages, onChunk) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    let lastError;
    for (const model of MODEL_FALLBACKS) {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'BrightNero Call Summariser',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          extra_headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
        }),
      });

      if (res.status === 429 || res.status === 404) {
        const text = await res.text();
        lastError = new Error(`OpenRouter error ${res.status} (${model}): ${text}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') continue;
          try {
            const json = JSON.parse(raw);
            const content = json.choices?.[0]?.delta?.content;
            if (content) { fullContent += content; onChunk(content); }
          } catch {}
        }
      }

      buffer += decoder.decode();
      for (const line of buffer.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') continue;
        try {
          const json = JSON.parse(raw);
          const content = json.choices?.[0]?.delta?.content;
          if (content) { fullContent += content; onChunk(content); }
        } catch {}
      }

      return { content: fullContent, model };
    }

    throw lastError || new Error('All models rate-limited. Try again shortly.');
  }

  async _callLLM(messages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    let lastError;
    for (const model of MODEL_FALLBACKS) {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'BrightNero Call Summariser',
        },
        body: JSON.stringify({
          model,
          messages,
          extra_headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
        }),
      });

      if (res.status === 429 || res.status === 404) {
        const text = await res.text();
        lastError = new Error(`OpenRouter error ${res.status} (${model}): ${text}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from model');
      return { content, model };
    }

    throw lastError || new Error('All models rate-limited. Try again shortly.');
  }
}
