import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';

// 20 summarise requests per IP per 15 minutes
export const summariseLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  handler(req, res, _next, options) {
    logger.warn('Rate limit hit', { ip: req.ip, path: req.path });
    res.status(429).json(options.message);
  },
});

// 100 read requests per IP per 15 minutes
export const readLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const MAX_TRANSCRIPT_CHARS = 50_000;

export function validateTranscript(req, res, next) {
  const body = req.body?.transcript ?? '';
  const fileSize = req.file?.size ?? 0;

  if (fileSize > 100_000) {
    return res.status(413).json({ error: 'Transcript file too large (max 100 KB).' });
  }
  if (typeof body === 'string' && body.length > MAX_TRANSCRIPT_CHARS) {
    return res.status(413).json({ error: `Transcript too long (max ${MAX_TRANSCRIPT_CHARS} characters).` });
  }

  next();
}

// Optional API key guard — only active when API_KEY env var is set
export function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return next();

  const header = req.headers['authorization'] ?? req.headers['x-api-key'] ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : header;

  if (!provided || provided !== expected) {
    logger.warn('Unauthorised request', { ip: req.ip, path: req.path });
    return res.status(401).json({ error: 'Unauthorised.' });
  }

  next();
}
