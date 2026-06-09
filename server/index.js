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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api', summariseRouter);
app.use('/api', searchRouter);

// Serve built React app in production
app.use(express.static(join(__dirname, '../client/dist')));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
