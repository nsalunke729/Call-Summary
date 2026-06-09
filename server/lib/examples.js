import { readFile } from 'fs/promises';
import { join } from 'path';

// process.cwd() is the project root both locally and on Vercel (/var/task)
const EXAMPLES_DIR = join(process.cwd(), 'bb-hiring-call-summary/examples');

// good-1: insurance rep payment update (inbound, proper Caller: format)
// good-3: policyholder claims status update (inbound)
// good-4: policyholder vehicle repair query (inbound, has Vehicle Damage context)
const SELECTED = ['good-1', 'good-3', 'good-4'];

let cached = null;

export async function getFewShots() {
  if (cached) return cached;

  cached = await Promise.all(
    SELECTED.map(async (name) => {
      const [transcript, summary] = await Promise.all([
        readFile(join(EXAMPLES_DIR, `${name}-transcript.txt`), 'utf8'),
        readFile(join(EXAMPLES_DIR, `${name}-summary.txt`), 'utf8'),
      ]);
      return { transcript: transcript.trim(), summary: summary.trim() };
    })
  );

  return cached;
}
