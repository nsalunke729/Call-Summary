import { searchByTopic, searchByEmotion } from '../server/lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const topic = req.query?.topic?.trim();
  const emotion = req.query?.emotion?.trim();

  if (!topic && !emotion) {
    return res.status(400).json({ error: 'Provide a ?topic= or ?emotion= query parameter.' });
  }

  try {
    const results = topic
      ? await searchByTopic(topic)
      : await searchByEmotion(emotion);
    res.json({ results, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Search failed.' });
  }
}
