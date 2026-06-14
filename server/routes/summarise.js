import { Router } from 'express';
import multer from 'multer';
import { Summariser } from '../lib/summariser.js';
import { validateTranscript } from '../lib/security.js';
import { cleanTranscript, transcriptStats } from '../lib/preprocessor.js';
import { logger } from '../lib/logger.js';
import { captureException } from '../lib/sentry.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_000_000 } });
const summariser = new Summariser();

router.post('/summarise', upload.single('file'), validateTranscript, async (req, res) => {
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

  const cleaned = cleanTranscript(transcript);
  const stats = transcriptStats(transcript, cleaned);
  if (stats.savedChars > 0) {
    logger.info('Transcript cleaned', stats);
  }
  transcript = cleaned;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  const start = Date.now();
  try {
    const result = await summariser.summariseStream(
      transcript,
      (content) => send({ type: 'chunk', content }),
      () => send({ type: 'analysing' }),
    );
    logger.info('Summary generated', { id: result.id, charCount: result.characterCount, latencyMs: result.latencyMs, model: result.model });
    send({ type: 'done', ...result });
  } catch (err) {
    logger.error('Summary generation failed', { error: err.message, durationMs: Date.now() - start });
    captureException(err, { transcriptLength: transcript.length });
    send({ type: 'error', error: err.message || 'Failed to generate summary.' });
  } finally {
    res.end();
  }
});

export default router;
