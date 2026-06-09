import { getRecentSummaries } from '../server/lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(parseInt(req.query?.limit) || 20, 100);
  const offset = parseInt(req.query?.offset) || 0;

  try {
    const results = await getRecentSummaries({ limit, offset });
    res.json({ results, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch summaries.' });
  }
}
