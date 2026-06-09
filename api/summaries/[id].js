import { deleteCallSummary } from '../../server/lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const id = parseInt(req.query.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Invalid id.' });

  try {
    const deleted = await deleteCallSummary(id);
    if (!deleted) return res.status(404).json({ error: 'Record not found.' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Delete failed.' });
  }
}
