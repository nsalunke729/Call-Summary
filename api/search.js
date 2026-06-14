import { searchByTopic, searchByEmotion, searchByText } from '../server/lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const topic = req.query?.topic?.trim();
  const emotion = req.query?.emotion?.trim();
  const q = req.query?.q?.trim();

  if (!topic && !emotion && !q) {
    return res.status(400).json({ error: 'Provide a ?topic=, ?emotion=, or ?q= query parameter.' });
  }

  try {
    const results = topic
      ? await searchByTopic(topic)
      : emotion
      ? await searchByEmotion(emotion)
      : await searchByText(q);
    res.json({ results, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Search failed.' });
  }
}
