# BrightNero — Call Summarisation Tool

An AI-powered web application that generates structured CRM summaries from insurance call transcripts.

---

## Architecture

```
User (Browser)
     │
     │  paste / upload transcript
     ▼
┌──────────────────────────┐
│      React Frontend      │
│   Vite dev server :5173  │
│                          │
│  TranscriptInput.jsx     │  ← drag-drop or paste .txt file
│  SummaryOutput.jsx       │  ← summary + character count badge + copy
└────────────┬─────────────┘
             │  POST /api/summarise  { transcript: "..." }
             ▼
┌──────────────────────────────────────────────┐
│             Express API  (port 3001)          │
│       server/routes/summarise.js             │
│                    │                         │
│                    ▼                         │
│       server/lib/summariser.js               │
│                                              │
│  1. Load 3 labelled few-shot examples        │
│     (good-1, good-3, good-4 from disk)       │
│  2. Build prompt:                            │
│     • system prompt (format + quality rules) │
│     • 3 example transcript→summary pairs     │
│     • live transcript                        │
│  3. POST to OpenRouter → Claude Opus         │
│  4. If response > 1,500 chars → retry once  │
│  5. Return { summary, charCount, latencyMs } │
└──────────────────────────────────────────────┘
             │
             ▼
     OpenRouter API
     anthropic/claude-opus-4-8
```

---

## Two Environments

| | Local Dev | Vercel (Production) |
|---|---|---|
| API entry point | `server/index.js` (Express + `app.listen`) | `api/summarise.js` (serverless function) |
| Frontend | Vite dev server `:5173` | Built `client/dist/` served as static CDN |
| Env vars | `.env` file (gitignored) | Vercel dashboard → Environment Variables |
| Start | `npm run dev` | Auto-deploy on every push to `master` |

---

## Deployment Pipeline

```
git push → master
      │
      ▼
GitHub Actions  (.github/workflows/deploy.yml)
      │  npx vercel --prod
      ▼
Vercel Build
  • cd client && npm install && npm run build
  • bundles api/summarise.js
    + bb-hiring-call-summary/examples/** (few-shot files)
  • serves client/dist as static CDN
      │
      ▼
Production URL (same domain → no CORS issues)
```

---

## Prompt Strategy

- **System prompt** — defines the exact required output format, 5-point quality checklist, and a list of common errors to avoid (wrong party identification, hallucinated confirmations, irrelevant sections, wrong company names).
- **Few-shot examples** — 3 labelled training pairs (good-1, good-3, good-4) are prepended as conversation turns so the model learns the expected format and tone from real data.
- **Character enforcement** — if the first response exceeds 1,500 characters, one automated retry asks the model to condense without dropping critical facts.

---

## Setup

**Prerequisites:** Node.js 18+

```bash
# 1. Install server dependencies
cd server && npm install && cd ..

# 2. Install client dependencies
cd client && npm install && cd ..

# 3. Configure your API key
cp .env.example .env
# Edit .env and set OPENROUTER_API_KEY=your_key_here
```

---

## Running Locally

```bash
# Terminal 1 — API server (hot-reload)
cd server && npm run dev

# Terminal 2 — React frontend
cd client && npm run dev
```

Open **http://localhost:5173**

```bash
# Or run both together from project root
npm run dev
```

---

## Output Format

```
Caller: [Name if known], [relationship], [inbound/outbound]

Subject:
[One-line description]

Executive Summary:
[Paragraph]
- [Key fact]
- [Key fact]

Next Steps:
[Company]: [Action or "None"]
Other:     [Action or "None"]

# Conditional sections — included only if discussed on the call:
Vehicle Damage / Liability Summary / Negotiation Summary / Injury / Property
```

Total output enforced to **≤ 1,500 characters**.

---

## Project Structure

```
BrightNero/
├── api/
│   └── summarise.js          # Vercel serverless entry point
├── server/
│   ├── index.js              # Local Express server
│   ├── routes/summarise.js   # POST /api/summarise handler
│   └── lib/
│       ├── summariser.js     # LLM call + retry logic
│       └── examples.js       # Few-shot example loader (cached)
├── client/
│   └── src/
│       ├── App.jsx
│       └── components/
│           ├── TranscriptInput.jsx
│           └── SummaryOutput.jsx
├── bb-hiring-call-summary/
│   ├── examples/             # 20 labelled training examples
│   └── to-summarise/         # 10 test transcripts
├── vercel.json
├── .github/workflows/deploy.yml
└── .env.example
```

---

## Test Transcripts

10 raw transcripts are in `bb-hiring-call-summary/to-summarise/`. Upload any via the UI to evaluate output quality against the labelled training examples.
