# BrightNero — Call Summarisation Tool

An AI-powered web application that generates structured CRM summaries from insurance call transcripts, extracts emotions and topics, and stores results in a searchable history.

---

## Features

- **Summarise** — paste or upload a `.txt` transcript; get a structured CRM-ready call note in under 10 seconds
- **Emotion & topic extraction** — a second LLM pass classifies the call into emotions (e.g. frustrated, anxious) and topics (e.g. vehicle damage, liability)
- **History tab** — browse recent summaries; filter by topic or emotion; click any badge to search
- **Delete records** — remove a history entry inline so you can re-submit the same transcript after prompt changes
- **Character enforcement** — output is auto-retried if it exceeds 1,500 characters

---

## Architecture

```
User (Browser)
     │
     │  paste / upload transcript
     ▼
┌─────────────────────────────────────┐
│           React Frontend            │
│                                     │
│  TranscriptInput.jsx                │  ← drag-drop or paste .txt
│  SummaryOutput.jsx                  │  ← summary + emotion/topic badges
│  HistoryTab.jsx                     │  ← recent records, filter, delete
└────────────┬────────────────────────┘
             │  POST /api/summarise
             │  GET  /api/summaries
             │  GET  /api/search?topic=|emotion=
             │  DELETE /api/summaries/:id
             ▼
┌─────────────────────────────────────────────────┐
│             Express API  (port 3001)             │
│                                                 │
│  server/routes/summarise.js                     │
│  server/routes/search.js                        │
│                                                 │
│  server/lib/summariser.js                       │
│    1. Load 3 few-shot examples from disk        │
│    2. Build messages: system + examples + input │
│    3. POST → OpenRouter → Claude Opus           │
│    4. Retry once if response > 1,500 chars      │
│    5. Call analyser.js → emotions + topics      │
│    6. Save to Neon Postgres (non-blocking)      │
│    7. Return { summary, emotions, topics, ... } │
│                                                 │
│  server/lib/analyser.js                         │
│    Second LLM call with 3 few-shot pairs        │
│    Returns { emotions: [...], topics: [...] }   │
│                                                 │
│  server/lib/db.js                               │
│    Neon serverless Postgres                     │
│    Skipped gracefully if POSTGRES_URL unset     │
└──────────────────┬──────────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   OpenRouter API     Neon Postgres
   claude-opus-4-8    call_summaries table
```

---

## Two Environments

| | Local Dev | Vercel (Production) |
|---|---|---|
| API entry points | `server/index.js` (Express) | `api/summarise.js`, `api/search.js`, `api/summaries.js`, `api/summaries/[id].js` (serverless) |
| Frontend | Vite dev server `:5173` | Built `client/dist/` served as static CDN |
| Database | Optional — skipped if `POSTGRES_URL` unset | Neon Postgres via `POSTGRES_URL` env var |
| Env vars | `.env` + `.env.local` (both gitignored) | Vercel dashboard → Environment Variables |
| Start | `npm run dev` | Auto-deploy on push to `master` |

---

## CI Pipeline

Every push runs three GitHub Actions jobs:

```
push / PR
    │
    ├── Lint         ESLint 9 flat config (server + client)
    ├── Security     npm audit --omit=dev --audit-level=high
    └── Tests        vitest run (16 tests across db, analyser, summariser)

PR only:
    └── Lighthouse   Build client → run Lighthouse CI
                     Performance ≥ 0.8 (warn), Accessibility ≥ 0.9 (error)
```

---

## Prompt Strategy

### Summariser (summariser.js)
- **System prompt** — exact output format, STT artifact handling (encoding corruption, garbled words, filler), quality checklist, and an explicit list of common errors (wrong party labelling, hallucinated confirmations, omitting IBANs/phone numbers, missing next steps)
- **Few-shot examples** — 3 labelled training pairs (good-1, good-3, good-4) prepended as conversation turns
- **Conditional sections** — Liability → Negotiation → Vehicle Damage → Injury → Property are included only when discussed; headings are omitted entirely otherwise
- **Character enforcement** — single automated retry with condensing instruction if first response > 1,500 chars

### Analyser (analyser.js)
- **Second LLM call** — takes the generated summary as input; extracts emotions and topics
- **Few-shot examples** — 3 summary→JSON pairs teach the expected output format
- **Controlled vocabulary** — responses filtered against 10 emotions and 14 topics; unrecognised values are dropped

---

## Database Schema

```sql
CREATE TABLE call_summaries (
  id          SERIAL PRIMARY KEY,
  transcript  TEXT          NOT NULL,
  summary     TEXT          NOT NULL,
  char_count  INTEGER       NOT NULL,
  emotions    TEXT[]        NOT NULL DEFAULT '{}',
  topics      TEXT[]        NOT NULL DEFAULT '{}',
  model       VARCHAR(120),
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/summarise` | Generate summary from transcript (JSON or multipart) |
| `GET` | `/api/summaries?limit=&offset=` | Fetch recent records (default limit 20) |
| `GET` | `/api/search?topic=` | Search records by topic |
| `GET` | `/api/search?emotion=` | Search records by emotion |
| `DELETE` | `/api/summaries/:id` | Delete a record by ID |

---

## Project Structure

```
BrightNero/
├── api/
│   ├── summarise.js             # Vercel: POST /api/summarise
│   ├── search.js                # Vercel: GET  /api/search
│   ├── summaries.js             # Vercel: GET  /api/summaries
│   └── summaries/
│       └── [id].js              # Vercel: DELETE /api/summaries/:id
├── server/
│   ├── index.js                 # Local Express server (port 3001)
│   ├── routes/
│   │   ├── summarise.js         # POST /api/summarise
│   │   └── search.js            # GET /search, GET /summaries, DELETE /summaries/:id
│   └── lib/
│       ├── summariser.js        # LLM call + retry + save to DB
│       ├── analyser.js          # Second LLM call → emotions + topics
│       ├── examples.js          # Few-shot loader (cached)
│       └── db.js                # Neon Postgres wrapper
├── client/
│   └── src/
│       ├── App.jsx              # Tab navigation (Summarise / History)
│       └── components/
│           ├── TranscriptInput.jsx
│           ├── SummaryOutput.jsx
│           └── HistoryTab.jsx   # Recent summaries, filter, delete
├── tests/
│   ├── db.test.js               # 5 tests: graceful no-op without POSTGRES_URL
│   ├── analyser.test.js         # 6 tests: JSON extraction, vocab filtering
│   └── summariser.test.js       # 5 tests: retry logic, response shape
├── bb-hiring-call-summary/
│   ├── examples/                # 20 labelled training examples + analysis JSON
│   └── to-summarise/            # 10 test transcripts
├── .github/workflows/
│   ├── ci.yml                   # Lint + Security + Tests
│   └── lighthouse.yml           # Lighthouse CI on PRs
├── eslint.config.js             # ESLint 9 flat config
├── lighthouserc.json
├── vercel.json
└── .env.example
```

---

## Setup

**Prerequisites:** Node.js 18+

```bash
# 1. Install all dependencies
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Set OPENROUTER_API_KEY in .env

# 3. (Optional) Pull Neon Postgres vars from Vercel
vercel link
vercel env pull .env.local
```

---

## Running Locally

```bash
# Run server + client together
npm run dev
```

Open **http://localhost:5173**

Without `POSTGRES_URL`, the app runs in DB-less mode — summaries are generated and displayed but not persisted. The History tab will show an empty state.

---

## Running Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

---

## Output Format

```
Caller: [Name], [relationship], [inbound/outbound]

Subject:
[One-line description]

Executive Summary:
[Paragraph: who called, why, what was resolved]
- [Key fact with specific value]
- [Key fact]

Next Steps:
[Company]: [Action or "None"]
Other:     [Action or "None"]

# Conditional — included only if discussed:
Liability Summary / Negotiation Summary / Vehicle Damage / Injury / Property
```

Total output enforced to **≤ 1,500 characters**.
