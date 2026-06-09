import { describe, it, expect, beforeEach } from 'vitest';

// Run with POSTGRES_URL unset so every function no-ops gracefully
beforeEach(() => {
  delete process.env.POSTGRES_URL;
});

describe('db — no POSTGRES_URL', () => {
  it('saveCallSummary returns null', async () => {
    const { saveCallSummary } = await import('../server/lib/db.js');
    const result = await saveCallSummary({
      transcript: 'test transcript',
      summary: 'test summary',
      characterCount: 12,
      emotions: ['neutral'],
      topics: ['payment'],
      model: 'test-model',
      latencyMs: 200,
    });
    expect(result).toBeNull();
  });

  it('searchByTopic returns empty array', async () => {
    const { searchByTopic } = await import('../server/lib/db.js');
    const result = await searchByTopic('payment');
    expect(result).toEqual([]);
  });

  it('searchByEmotion returns empty array', async () => {
    const { searchByEmotion } = await import('../server/lib/db.js');
    const result = await searchByEmotion('frustrated');
    expect(result).toEqual([]);
  });

  it('getRecentSummaries returns empty array', async () => {
    const { getRecentSummaries } = await import('../server/lib/db.js');
    const result = await getRecentSummaries();
    expect(result).toEqual([]);
  });

  it('getRecentSummaries respects limit and offset params', async () => {
    const { getRecentSummaries } = await import('../server/lib/db.js');
    const result = await getRecentSummaries({ limit: 5, offset: 10 });
    expect(result).toEqual([]);
  });

  it('deleteCallSummary returns false', async () => {
    const { deleteCallSummary } = await import('../server/lib/db.js');
    const result = await deleteCallSummary(1);
    expect(result).toBe(false);
  });

  it('rateCallSummary returns false', async () => {
    const { rateCallSummary } = await import('../server/lib/db.js');
    const result = await rateCallSummary(1, 1);
    expect(result).toBe(false);
  });

  it('getStats returns null', async () => {
    const { getStats } = await import('../server/lib/db.js');
    const result = await getStats();
    expect(result).toBeNull();
  });

  it('exportAllSummaries returns empty array', async () => {
    const { exportAllSummaries } = await import('../server/lib/db.js');
    const result = await exportAllSummaries();
    expect(result).toEqual([]);
  });
});
