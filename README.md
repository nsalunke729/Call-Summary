# BrightNero — Call Summarisation Tool

An AI-powered web application that generates structured CRM summaries from insurance call transcripts, extracts emotions and topics, and stores results in a searchable history.

---

## Features

- **Streaming summariser** — text appears word-by-word as the model generates it; no waiting for a complete response
- **Emotion & topic extraction** — a second LLM pass classifies the call into emotions (e.g. frustrated, anxious) and topics (e.g. vehicle damage, liability)
- **History tab** — browse recent summaries; filter by topic or emotion; view the original transcript inline; delete records
- **Stats tab** — total calls, avg summary length, avg latency; bar charts showing emotion and topic distribution
- **Export CSV** — download all records as a CSV file (id, date, emotions, topics, char count, latency, summary)
- **Feedback rating** — thumbs up / thumbs down on each summary (fresh and historical); stored in DB to build a quality signal over time
- **Character enforcement** — output is auto-retried if it exceeds 1,500 characters

---

## Architecture

```
User (Browser)
     │
     │  paste / upload transcript
     ▼
┌──────────────────────────────────────────┐
│              React Frontend              │
│                                          │
│  TranscriptInput.jsx                     │  ← drag-drop or paste .txt
│  SummaryOutput.jsx                       │  ← streaming text + rating
│  HistoryTab.jsx                          │  ← records, filter, transcript, export
│  StatsTab.jsx                            │  ← KPI cards + bar charts
│  RatingButtons.jsx                       │  ← shared Good / Poor component
└──────────────┬───────────────────────────┘
               │  POST   /api/summarise         (SSE stream)
               │  GET    /api/summaries
               │  GET    /api/search?topic=|emotion=
               │  PATCH  /api/summaries/:id     (rating)
               │  DELETE /api/summaries/:id
               │  GET    /api/stats
               │  GET    /api/export
               ▼
┌──────────────────────────────────────────────────┐
│              Express API  (port 3001)            │
│                                                  │
│  server/lib/summariser.js                        │
│    1. Load 3 few-shot examples from disk         │
│    2. Build messages: system + examples + input  │
│    3. Stream POST → OpenRouter → Claude Opus     │
│    4. Pipe chunks to client via SSE              │
│    5. Retry once (non-streaming) if > 1,500 chars│
│    6. Call analyser.js → emotions + topics       │
│    7. Await DB save → return id in response      │
│                                                  │
│  server/lib/analyser.js                          │
│    Second LLM call with 3 few-shot pairs         │
│    Returns { emotions: [...], topics: [...] }    │
│                                                  │
│  server/lib/db.js       Neon serverless Postgres │
│  server/lib/csv.js      RFC 4180 CSV builder     │
└──────────────────┬───────────────────────────────┘
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
| API entry points | `server/index.js` (Express) | `api/*.js` + `api/summaries/[id].js` (serverless) |
| Frontend | Vite dev server `:5173` | Built `client/dist/` served as static CDN |
| Database | Optional — skipped if `POSTGRES_URL` unset | Neon Postgres via `POSTGRES_URL` env var |
| Env vars | `.env` + `.env.local` (both gitignored) | Vercel dashboard → Environment Variables |
| Start | `npm run dev` | Auto-deploy on push to `master` |

---

## Streaming Flow

```
POST /api/summarise
      │
      │  SSE events:
      ├── { type: "chunk",     content: "Caller: ..." }   ← one per LLM token
      ├── { type: "analysing"                          }   ← summary done, analyser starting
      └── { type: "done",      summary, emotions, topics, id, latencyMs }

UI phases:
  spinner          → first chunk arrives
  text building up → streaming: true
  "Analysing…"     → analysing: true
  tags + rating    → done event received
```

---

## CI Pipeline

```
push / PR
    │
    ├── Lint         ESLint 9 flat config (server + client)
    ├── Security     npm audit --omit=dev --audit-level=high
    └── Tests        vitest run (32 tests across db, analyser, summariser, csv)

PR only:
    └── Lighthouse   Build client → Lighthouse CI
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
  rating      SMALLINT,                              -- 1 = good, -1 = poor, NULL = unrated
  model       VARCHAR(120),
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

The `rating` column is added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on every boot, so existing databases are migrated automatically.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/summarise` | Generate summary; returns SSE stream |
| `GET` | `/api/summaries?limit=&offset=` | Fetch recent records (default limit 20) |
| `GET` | `/api/search?topic=` | Search records by topic |
| `GET` | `/api/search?emotion=` | Search records by emotion |
| `PATCH` | `/api/summaries/:id` | Set rating (`{ rating: 1 \| -1 \| null }`) |
| `DELETE` | `/api/summaries/:id` | Delete a record |
| `GET` | `/api/stats` | Aggregated emotion/topic counts + KPIs |
| `GET` | `/api/export` | Download all records as CSV attachment |

---

## Project Structure

```
BrightNero/
├── api/
│   ├── summarise.js             # Vercel: POST /api/summarise (SSE)
│   ├── search.js                # Vercel: GET  /api/search
│   ├── summaries.js             # Vercel: GET  /api/summaries
│   ├── stats.js                 # Vercel: GET  /api/stats
│   ├── export.js                # Vercel: GET  /api/export
│   └── summaries/
│       └── [id].js              # Vercel: PATCH + DELETE /api/summaries/:id
├── server/
│   ├── index.js                 # Local Express server (port 3001)
│   ├── routes/
│   │   ├── summarise.js         # POST /api/summarise
│   │   └── search.js            # Search, summaries, stats, export, patch, delete
│   └── lib/
│       ├── summariser.js        # Streaming LLM call + retry + DB save
│       ├── analyser.js          # Second LLM call → emotions + topics
│       ├── examples.js          # Few-shot loader (cached)
│       ├── db.js                # Neon Postgres wrapper
│       └── csv.js               # RFC 4180 CSV builder
├── client/
│   └── src/
│       ├── App.jsx              # Tab navigation (Summarise / History / Stats)
│       └── components/
│           ├── TranscriptInput.jsx
│           ├── SummaryOutput.jsx   # Streaming output + rating
│           ├── HistoryTab.jsx      # Records, filter, transcript view, export
│           ├── StatsTab.jsx        # KPI cards + CSS bar charts
│           └── RatingButtons.jsx   # Shared Good / Poor rating component
├── tests/
│   ├── db.test.js               # 9 tests: graceful no-op without POSTGRES_URL
│   ├── analyser.test.js         # 6 tests: JSON extraction, vocab filtering
│   ├── summariser.test.js       # 10 tests: retry logic, streaming, id return
│   └── csv.test.js              # 7 tests: header row, array joining, field escaping
├── bb-hiring-call-summary/
│   ├── examples/                # 20 labelled training examples + analysis JSON
│   └── to-summarise/            # 10 test transcripts
├── .github/workflows/
│   ├── ci.yml                   # Lint + Security + Tests
│   └── lighthouse.yml           # Lighthouse CI on PRs
├── eslint.config.js
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
npm run dev
```

Open **http://localhost:5173**

Without `POSTGRES_URL` the app runs in DB-less mode — summaries are generated and displayed but not persisted. History, Stats, Export, and rating will be unavailable.

---

## Running Tests

```bash
npm test            # run once
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
