import { exportAllSummaries } from '../server/lib/db.js';
import { buildCSV } from '../server/lib/csv.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rows = await exportAllSummaries();
    const csv = buildCSV(rows);
    const filename = `call-summaries-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Export failed.' });
  }
}
