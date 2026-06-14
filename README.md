# BrightNero — Call Summarisation Tool

An AI-powered web application that generates structured CRM summaries from insurance call transcripts, extracts emotions and topics, and stores results in a searchable history.

---

## Features

- **Streaming summariser** — text appears word-by-word as the model generates it via SSE; no waiting for a complete response
- **STT noise stripping** — filler words (`um`, `uh`, `er`), `[inaudible]`/`[crosstalk]` tags, and encoding artifacts are removed before the LLM call to reduce token usage
- **Prompt caching** — system prompt and few-shot examples are marked with `cache_control` so Anthropic reuses the KV cache across calls (lower latency + cost on cache hits)
- **Dynamic model fallback** — if the primary model is rate-limited or unavailable, the app fetches OpenRouter's live free model list and tries each in turn automatically
- **Emotion & topic extraction** — a second LLM pass classifies the call into emotions (e.g. frustrated, anxious) and topics (e.g. vehicle damage, liability)
- **History tab** — browse recent summaries; free-text search across topics, emotions, and summary text; filter by topic or emotion; view the original transcript inline; delete records
- **Stats tab** — total calls, avg summary length, avg latency; quality section (good/poor/unrated counts + satisfaction %); bar charts showing emotion and topic distribution
- **Export CSV** — download all records as a CSV file (id, date, emotions, topics, char count, latency, summary)
- **Feedback rating** — thumbs up / thumbs down on each summary (fresh and historical); stored in DB to build a quality signal
- **Character enforcement** — output is auto-retried if it exceeds 1,500 characters
- **Rate limiting** — 20 req/15 min on `/api/summarise`, 100 req/15 min on read endpoints
- **Optional API key auth** — set `API_KEY` env var to require `Authorization: Bearer` on all API calls
- **Mobile-responsive** — two-column layout collapses to single column on screens ≤ 768 px
- **Structured logging** — all server events emit JSON log lines; optional Sentry integration via `SENTRY_DSN`

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
│  TranscriptInput.jsx   drag-drop / paste │  ← live char count, 50k limit guard
│  SummaryOutput.jsx     streaming + rating│
│  HistoryTab.jsx        records + search  │
│  StatsTab.jsx          KPIs + quality    │
│  RatingButtons.jsx     Good / Poor       │
└──────────────┬───────────────────────────┘
               │  POST   /api/summarise         (SSE stream)
               │  GET    /api/summaries
               │  GET    /api/search?q=|topic=|emotion=
               │  PATCH  /api/summaries/:id     (rating)
               │  DELETE /api/summaries/:id
               │  GET    /api/stats
               │  GET    /api/export
               ▼
┌──────────────────────────────────────────────────┐
│              Express API  (port 3001)            │
│                                                  │
│  security.js  rate limit + API key + size check  │
│                                                  │
│  preprocessor.js  strip STT noise pre-LLM        │
│                                                  │
│  summariser.js                                   │
│    1. Load 3 few-shot examples from disk         │
│    2. Build messages (system + examples + input) │
│       with cache_control on static turns         │
│    3. Try MODEL env var, then live free models   │
│       from OpenRouter API (429/404/400 → next)   │
│    4. Stream tokens to client via SSE            │
│    5. Retry once (non-streaming) if > 1,500 chars│
│    6. Call analyser.js → emotions + topics       │
│    7. Await DB save → return id in response      │
│                                                  │
│  analyser.js  second LLM call with same fallback │
│  models.js    live free model discovery (1h cache│
│  db.js        Neon serverless Postgres           │
│  csv.js       RFC 4180 CSV builder               │
│  logger.js    structured JSON logs               │
│  sentry.js    optional error capture             │
└──────────────────┬───────────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   OpenRouter API     Neon Postgres
   (primary model     call_summaries table
    + free fallbacks)
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
    └── Tests        vitest run (45 tests across db, analyser, summariser, csv, preprocessor)

PR only:
    └── Lighthouse   Build client → Lighthouse CI
                     Performance ≥ 0.8 (warn), Accessibility ≥ 0.9 (error)
```

---

## Prompt Strategy

### Summariser (summariser.js)
- **Preprocessing** — STT noise stripped before building the prompt (saves ~5–15% tokens on typical transcripts)
- **System prompt** — exact output format, STT artifact handling (encoding corruption, garbled words, filler), quality checklist, and an explicit list of common errors (wrong party labelling, hallucinated confirmations, omitting IBANs/phone numbers, missing next steps)
- **Few-shot examples** — 3 labelled training pairs (good-1, good-3, good-4) prepended as conversation turns
- **Prompt caching** — system prompt + last few-shot turn carry `cache_control: { type: "ephemeral" }` for Anthropic KV cache reuse
- **Conditional sections** — Liability → Negotiation → Vehicle Damage → Injury → Property included only when discussed; headings omitted entirely otherwise
- **Character enforcement** — single automated retry with condensing instruction if first response > 1,500 chars

### Analyser (analyser.js)
- **Second LLM call** — takes the generated summary as input; extracts emotions and topics
- **Few-shot examples** — 3 summary→JSON pairs teach the expected output format
- **Controlled vocabulary** — responses filtered against 10 emotions and 14 topics; unrecognised values are dropped

### Model Fallback (models.js)
- Tries `MODEL` env var first (paid or free)
- On 429 / 404 / 400 → fetches live free model list from `GET /openrouter.ai/api/v1/models`, caches for 1 hour, tries each in turn
- Falls back to a hardcoded list if the API is unreachable

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
| `GET` | `/api/search?q=` | Free-text search across topics, emotions, and summary |
| `GET` | `/api/search?topic=` | Filter records by exact topic |
| `GET` | `/api/search?emotion=` | Filter records by exact emotion |
| `PATCH` | `/api/summaries/:id` | Set rating (`{ rating: 1 \| -1 \| null }`) |
| `DELETE` | `/api/summaries/:id` | Delete a record |
| `GET` | `/api/stats` | KPIs + quality breakdown + emotion/topic counts |
| `GET` | `/api/export` | Download all records as CSV attachment |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `POSTGRES_URL` | No | Neon connection string; app runs DB-less without it |
| `MODEL` | No | Primary model slug (e.g. `meta-llama/llama-3.3-70b-instruct:free`); falls back to live free models |
| `PORT` | No | Local server port (default `3001`) |
| `API_KEY` | No | If set, all `/api/*` requests must include `Authorization: Bearer <key>` |
| `SENTRY_DSN` | No | Sentry DSN for error tracking; disabled when unset |

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
│       ├── preprocessor.js      # STT noise stripping pre-LLM
│       ├── models.js            # Live free model discovery + cache
│       ├── examples.js          # Few-shot loader (cached)
│       ├── db.js                # Neon Postgres wrapper
│       ├── csv.js               # RFC 4180 CSV builder
│       ├── logger.js            # Structured JSON logger
│       ├── sentry.js            # Optional Sentry error capture
│       └── security.js          # Rate limiting, API key auth, input validation
├── client/
│   └── src/
│       ├── App.jsx              # Tab navigation (Summarise / History / Stats)
│       ├── index.css            # Global styles + responsive layout breakpoints
│       └── components/
│           ├── TranscriptInput.jsx   # Drag-drop + char count + 50k limit guard
│           ├── SummaryOutput.jsx     # Streaming output + rating
│           ├── HistoryTab.jsx        # Records, search, filter, transcript view, export
│           ├── StatsTab.jsx          # KPI cards + quality metrics + CSS bar charts
│           └── RatingButtons.jsx     # Shared Good / Poor rating component
├── tests/
│   ├── db.test.js               # 9 tests: graceful no-op without POSTGRES_URL
│   ├── analyser.test.js         # 6 tests: JSON extraction, vocab filtering
│   ├── summariser.test.js       # 10 tests: retry logic, streaming, id return
│   ├── csv.test.js              # 7 tests: header row, array joining, field escaping
│   └── preprocessor.test.js     # 13 tests: STT tag removal, filler words, encoding
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
# Optionally set MODEL, POSTGRES_URL, API_KEY, SENTRY_DSN

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
