import { searchByTopic } from '../server/lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const topic = req.query?.topic?.trim();
  if (!topic) return res.status(400).json({ error: 'Provide a ?topic= query parameter.' });

  try {
    const results = await searchByTopic(topic);
    res.json({ results, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Search failed.' });
  }
}
