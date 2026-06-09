import { deleteCallSummary, rateCallSummary } from '../../server/lib/db.js';

export default async function handler(req, res) {
  const id = parseInt(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid id.' });

  if (req.method === 'DELETE') {
    try {
      const deleted = await deleteCallSummary(id);
      if (!deleted) return res.status(404).json({ error: 'Record not found.' });
      res.json({ deleted: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Delete failed.' });
    }
    return;
  }

  if (req.method === 'PATCH') {
    const { rating } = req.body;
    if (rating !== 1 && rating !== -1 && rating !== null) {
      return res.status(400).json({ error: 'Rating must be 1, -1, or null.' });
    }
    try {
      await rateCallSummary(id, rating);
      res.json({ rated: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || 'Rating failed.' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
