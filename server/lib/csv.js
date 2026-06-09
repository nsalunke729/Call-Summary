const HEADERS = ['id', 'created_at', 'emotions', 'topics', 'char_count', 'latency_ms', 'summary'];

function escape(value) {
  const str = value == null ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCSV(rows) {
  const lines = [HEADERS.join(',')];
  for (const row of rows) {
    lines.push([
      escape(row.id),
      escape(row.created_at),
      escape((row.emotions || []).join('; ')),
      escape((row.topics   || []).join('; ')),
      escape(row.char_count),
      escape(row.latency_ms),
      escape(row.summary),
    ].join(','));
  }
  return lines.join('\r\n');
}
