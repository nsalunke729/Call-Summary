import { getStats } from '../server/lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const stats = await getStats();
    if (!stats) return res.status(503).json({ error: 'Database not available.' });
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch stats.' });
  }
}
