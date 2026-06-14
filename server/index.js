import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { resolve, dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../.env.local'), override: true });

import express from 'express';
import cors from 'cors';
import summariseRouter from './routes/summarise.js';
import searchRouter from './routes/search.js';
import { logger } from './lib/logger.js';
import { initSentry } from './lib/sentry.js';
import { summariseLimit, readLimit, requireApiKey } from './lib/security.js';

await initSentry();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

app.use('/api', requireApiKey);
app.use('/api/summarise', summariseLimit);
app.use('/api/search', readLimit);
app.use('/api/summaries', readLimit);
app.use('/api/stats', readLimit);
app.use('/api/export', readLimit);

app.use('/api', summariseRouter);
app.use('/api', searchRouter);

// Serve built React app in production
app.use(express.static(join(__dirname, '../client/dist')));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, url: `http://localhost:${PORT}` });
});
