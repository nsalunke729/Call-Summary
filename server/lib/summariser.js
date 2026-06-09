import { getFewShots } from './examples.js';
import { analyseCallSummary } from './analyser.js';
import { saveCallSummary } from './db.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.MODEL || 'anthropic/claude-opus-4-8';
const MAX_CHARS = 1500;

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

CONDITIONAL SECTIONS — include ONLY if that topic was actually discussed on this call. Omit the section header entirely if not mentioned:

Vehicle Damage:
Vehicle Status: [drivable / written off / at garage / etc.]
Towage: [details or "None"]
Car hire: [details or "None"]

Liability Summary:
[Positions of each party; any admissions or denials; split liability % if agreed]

Negotiation Summary:
[Offer made, counter-offer, agreed settlement or current position]

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

COMMON ERRORS TO AVOID:
- Labelling a third-party solicitor, insurer rep, or garage as "customer" or "policyholder"
- Getting the caller's company name wrong (listen for it explicitly — do not infer from the claim)
- Stating something was confirmed, agreed, or promised when the transcript is ambiguous
- Including Vehicle Damage / Liability / Negotiation / Injury / Property sections when those topics were NOT discussed
- Repeating the same fact in the paragraph and in a bullet point
- Misidentifying who insures whom (especially in dog/animal incidents, dual-insurance, or fleet scenarios)
- Speech-to-text garbling — use context to resolve unclear words (e.g. "eye ban" → IBAN, "reg" → vehicle registration)
- Omitting critical next steps (if an agent promised a callback, that must appear in Next Steps)

Output only the summary. No preamble, no explanation, no markdown formatting.`;

export class Summariser {
  async summarise(transcript) {
    const fewShots = await getFewShots();
    const messages = this._buildMessages(fewShots, transcript);

    const start = Date.now();
    let summary = await this._callLLM(messages);
    summary = summary.trim();

    if (summary.length > MAX_CHARS) {
      messages.push(
        { role: 'assistant', content: summary },
        {
          role: 'user',
          content: `Your response was ${summary.length} characters. Revise it to stay within ${MAX_CHARS} characters without omitting critical facts.`,
        }
      );
      summary = (await this._callLLM(messages)).trim();
    }

    const { emotions, topics } = await analyseCallSummary(summary);

    saveCallSummary({
      transcript,
      summary,
      characterCount: summary.length,
      emotions,
      topics,
      model: MODEL,
      latencyMs: Date.now() - start,
    }).catch(err => console.error('DB save failed (non-fatal):', err.message));

    return {
      summary,
      characterCount: summary.length,
      emotions,
      topics,
      model: MODEL,
      latencyMs: Date.now() - start,
    };
  }

  _buildMessages(fewShots, transcript) {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

    for (const { transcript: t, summary: s } of fewShots) {
      messages.push(
        { role: 'user', content: t },
        { role: 'assistant', content: s }
      );
    }

    messages.push({ role: 'user', content: transcript });
    return messages;
  }

  async _callLLM(messages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'BrightNero Call Summariser',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from model');
    return content;
  }
}
