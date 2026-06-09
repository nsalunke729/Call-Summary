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
    SELECT id, transcript, summary, char_count, emotions, topics, model, latency_ms, created_at
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
    SELECT id, transcript, summary, char_count, emotions, topics, model, latency_ms, created_at
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
    SELECT id, transcript, summary, char_count, emotions, topics, model, latency_ms, created_at
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

export async function exportAllSummaries() {
  const sql = await getSQL();
  if (!sql) return [];
  const result = await sql`
    SELECT id, created_at, emotions, topics, char_count, latency_ms, summary
    FROM call_summaries
    ORDER BY created_at DESC
  `;
  return result;
}

export async function getStats() {
  const sql = await getSQL();
  if (!sql) return null;

  const [totals, emotions, topics] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int                    AS total_calls,
        ROUND(AVG(char_count))::int      AS avg_char_count,
        ROUND(AVG(latency_ms))::int      AS avg_latency_ms
      FROM call_summaries
    `,
    sql`
      SELECT emotion, COUNT(*)::int AS count
      FROM call_summaries, UNNEST(emotions) AS emotion
      GROUP BY emotion
      ORDER BY count DESC
    `,
    sql`
      SELECT topic, COUNT(*)::int AS count
      FROM call_summaries, UNNEST(topics) AS topic
      GROUP BY topic
      ORDER BY count DESC
    `,
  ]);

  return {
    totalCalls: totals[0].total_calls,
    avgCharCount: totals[0].avg_char_count,
    avgLatencyMs: totals[0].avg_latency_ms,
    emotions: emotions.map(r => ({ name: r.emotion, count: r.count })),
    topics:   topics.map(r => ({ name: r.topic,   count: r.count })),
  };
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
