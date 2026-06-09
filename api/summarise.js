import { Summariser } from '../server/lib/summariser.js';

const summariser = new Summariser();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const transcript = req.body?.transcript?.trim();
  if (!transcript) {
    return res.status(400).json({ error: 'Provide a transcript in the request body.' });
  }

  try {
    const result = await summariser.summarise(transcript);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate summary.' });
  }
}
