import { Router } from 'express';
import { searchByTopic, searchByEmotion, getRecentSummaries } from '../lib/db.js';

const router = Router();

router.get('/search', async (req, res) => {
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
});

router.get('/summaries', async (req, res) => {
  const limit = Math.min(parseInt(req.query?.limit) || 20, 100);
  const offset = parseInt(req.query?.offset) || 0;

  try {
    const results = await getRecentSummaries({ limit, offset });
    res.json({ results, count: results.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to fetch summaries.' });
  }
});

export default router;
