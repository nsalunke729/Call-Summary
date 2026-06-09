import { Router } from 'express';
import multer from 'multer';
import { Summariser } from '../lib/summariser.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_000_000 } });
const summariser = new Summariser();

router.post('/summarise', upload.single('file'), async (req, res) => {
  let transcript;

  if (req.file) {
    transcript = req.file.buffer.toString('utf8');
  } else if (req.body?.transcript) {
    transcript = req.body.transcript;
  }

  transcript = transcript?.trim();
  if (!transcript) {
    return res.status(400).json({ error: 'Provide a transcript file or text body.' });
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
});

export default router;
