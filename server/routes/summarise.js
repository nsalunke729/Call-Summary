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
  } else {
    return res.status(400).json({ error: 'Provide a transcript file or text body.' });
  }

  transcript = transcript.trim();
  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is empty.' });
  }

  try {
    const result = await summariser.summarise(transcript);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate summary.' });
  }
});

export default router;
