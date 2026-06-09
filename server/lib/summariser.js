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
[One paragraph explaining what happened and why]
- [Key fact from the call]
- [Key fact from the call]
- [Additional bullets as needed]

Next Steps:
[Company name]: [Action required, or "None"]
Other: [Action required by other parties, or "None"]

CONDITIONAL SECTIONS — include only if that topic was actually discussed. Omit entirely if not discussed (do not write "None" for sections that weren't mentioned):

Vehicle Damage:
Vehicle Status: [drivable / written off / at garage / etc.]
Towage: [details or "None"]
Car hire: [details or "None"]

Liability Summary:
[Only if liability was discussed]

Negotiation Summary:
[Only if negotiation occurred]

Injury:
Treatment: [details of injury discussion]

Property:
[details of property damage]

QUALITY RULES:
1. Identify the caller correctly — are they the policyholder, a third-party solicitor, a family member, an insurance rep from another company? Never assume.
2. Facts must be accurate — correct reference numbers, amounts, names, email addresses, IBANs. Do not invent or guess.
3. Another agent must be able to understand exactly what happened and what to do next.
4. Professional tone — suitable for sharing with the customer.
5. Total output must be ≤ ${MAX_CHARS} characters.

COMMON ERRORS TO AVOID:
- Labelling a third-party solicitor as "customer" or "policyholder"
- Getting the caller's company name wrong
- Stating something was confirmed when the transcript doesn't confirm it
- Including liability, negotiation, vehicle damage, injury, or property sections when those topics weren't discussed
- Repeating the same fact in multiple sections
- Misidentifying who insures whom (especially in dog/animal incidents or dual-insurance scenarios)
- Transcripts from speech-to-text may contain garbled words — use context clues to determine the correct meaning

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
