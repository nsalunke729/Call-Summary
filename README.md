# BrightNero Call Summariser

An AI-powered web application that generates structured CRM summaries from insurance call transcripts.

## How it works

1. **Frontend** (React + Vite): A two-panel UI where you paste or upload a `.txt` transcript on the left and receive the structured summary on the right.
2. **Backend** (Node.js + Express): A single `POST /api/summarise` endpoint that accepts the transcript, builds a few-shot prompt from labelled training examples, calls the LLM via OpenRouter, enforces the ≤ 1,500 character limit with a retry, and returns the result.
3. **LLM**: Claude Opus via OpenRouter by default. Swap the model by setting `MODEL` in your `.env`.

### Prompt strategy

- A detailed system prompt defines the exact output format, quality checklist, and a list of common errors to avoid (wrong party identification, hallucinated confirmations, irrelevant sections).
- Three curated training examples (good-1, good-3, good-4) are prepended as few-shot turns so the model learns the expected format and tone from real labelled data.
- If the first response exceeds 1,500 characters, a single retry asks the model to condense without losing critical facts.

## Setup

**Prerequisites:** Node.js 18+

```bash
# 1. Install server dependencies
npm install

# 2. Install client dependencies
cd client && npm install && cd ..

# 3. Configure your API key
cp .env.example .env
# Edit .env and set OPENROUTER_API_KEY=your_key_here
```

## Running

```bash
# Development (hot-reload server + Vite client)
npm run dev
```

Open **http://localhost:5173** in your browser.

```bash
# Production build
npm run build       # builds React into client/dist
npm start           # serves both API and static files on port 3001
```

## Output format

```
Caller: [Name], [relationship], [inbound/outbound]

Subject:
[One-line description]

Executive Summary:
[Paragraph]
- [Key fact]
- [Key fact]

Next Steps:
[Company]: [Action or "None"]
Other: [Action or "None"]

# Conditional sections (only when discussed):
Vehicle Damage / Liability Summary / Negotiation Summary / Injury / Property
```

Total output is enforced to ≤ 1,500 characters.

## Test transcripts

Sample transcripts are in `bb-hiring-call-summary/to-summarise/`. Upload any of the 10 files via the UI to evaluate the output.
