let _sql = null;

async function getSQL() {
  if (!process.env.POSTGRES_URL) return null;
  if (_sql) return _sql;
  const { neon } = await import('@neondatabase/serverless');
  _sql = neon(process.env.POSTGRES_URL);
  return _sql;
}

export async function ensureSchema() {
  const sql = await getSQL();
  if (!sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS call_summaries (
      id          SERIAL PRIMARY KEY,
      transcript  TEXT          NOT NULL,
      summary     TEXT          NOT NULL,
      char_count  INTEGER       NOT NULL,
      emotions    TEXT[]        NOT NULL DEFAULT '{}',
      topics      TEXT[]        NOT NULL DEFAULT '{}',
      model       VARCHAR(120),
      latency_ms  INTEGER,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
}

export async function searchByEmotion(emotion) {
  const sql = await getSQL();
  if (!sql) return [];
  const result = await sql`
    SELECT id, summary, char_count, emotions, topics, model, latency_ms, created_at
    FROM call_summaries
    WHERE ${emotion} = ANY(emotions)
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return result;
}

export async function searchByTopic(topic) {
  const sql = await getSQL();
  if (!sql) return [];
  const result = await sql`
    SELECT id, summary, char_count, emotions, topics, model, latency_ms, created_at
    FROM call_summaries
    WHERE ${topic} = ANY(topics)
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return result;
}

export async function getRecentSummaries({ limit = 20, offset = 0 } = {}) {
  const sql = await getSQL();
  if (!sql) return [];
  const result = await sql`
    SELECT id, summary, char_count, emotions, topics, model, latency_ms, created_at
    FROM call_summaries
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return result;
}

export async function deleteCallSummary(id) {
  const sql = await getSQL();
  if (!sql) return false;
  const result = await sql`
    DELETE FROM call_summaries WHERE id = ${id} RETURNING id
  `;
  return result.length > 0;
}

export async function saveCallSummary({ transcript, summary, characterCount, emotions, topics, model, latencyMs }) {
  const sql = await getSQL();
  if (!sql) return null;

  await ensureSchema();

  const result = await sql`
    INSERT INTO call_summaries (transcript, summary, char_count, emotions, topics, model, latency_ms)
    VALUES (${transcript}, ${summary}, ${characterCount}, ${emotions}, ${topics}, ${model}, ${latencyMs})
    RETURNING id, created_at
  `;
  return result[0];
}
