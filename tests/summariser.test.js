import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Stub the few-shot loader and analyser so tests are self-contained
vi.mock('../server/lib/examples.js', () => ({
  getFewShots: async () => [
    { transcript: 'example transcript', summary: 'example summary' },
  ],
}));

vi.mock('../server/lib/analyser.js', () => ({
  analyseCallSummary: async () => ({ emotions: ['neutral'], topics: ['payment'] }),
}));

vi.mock('../server/lib/db.js', () => ({
  saveCallSummary: async () => null,
}));

function makeLLMResponse(content) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  vi.resetAllMocks();
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe('Summariser', () => {
  it('returns summary with characterCount, emotions, topics, model, latencyMs', async () => {
    mockFetch.mockResolvedValueOnce(makeLLMResponse('Caller: Policyholder, inbound\n\nSubject:\nTest'));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    const result = await s.summarise('test transcript');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('characterCount');
    expect(result).toHaveProperty('emotions');
    expect(result).toHaveProperty('topics');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('latencyMs');
  });

  it('retries when first response exceeds 1500 characters', async () => {
    const longSummary = 'A'.repeat(1501);
    const shortSummary = 'Short summary within limit.';
    mockFetch
      .mockResolvedValueOnce(makeLLMResponse(longSummary))
      .mockResolvedValueOnce(makeLLMResponse(shortSummary));

    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    const result = await s.summarise('test transcript');
    expect(result.summary).toBe(shortSummary);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('characterCount matches summary length', async () => {
    const content = 'Caller: Test, inbound\n\nSubject:\nTest subject';
    mockFetch.mockResolvedValueOnce(makeLLMResponse(content));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    const result = await s.summarise('test transcript');
    expect(result.characterCount).toBe(result.summary.length);
  });

  it('throws when API key is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    await expect(s.summarise('test')).rejects.toThrow('OPENROUTER_API_KEY');
  });

  it('throws when LLM returns an error status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    await expect(s.summarise('test')).rejects.toThrow('500');
  });
});
