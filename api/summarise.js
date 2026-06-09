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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  try {
    const result = await summariser.summariseStream(
      transcript,
      (content) => send({ type: 'chunk', content }),
      () => send({ type: 'analysing' }),
    );
    send({ type: 'done', ...result });
  } catch (err) {
    console.error(err);
    send({ type: 'error', error: err.message || 'Failed to generate summary.' });
  } finally {
    res.end();
  }
}

export const config = { supportsResponseStreaming: true };
