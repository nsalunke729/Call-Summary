import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockSaveCallSummary = vi.hoisted(() => vi.fn());

vi.mock('../server/lib/examples.js', () => ({
  getFewShots: async () => [
    { transcript: 'example transcript', summary: 'example summary' },
  ],
}));

vi.mock('../server/lib/analyser.js', () => ({
  analyseCallSummary: async () => ({ emotions: ['neutral'], topics: ['payment'] }),
}));

vi.mock('../server/lib/db.js', () => ({
  saveCallSummary: mockSaveCallSummary,
}));

vi.mock('../server/lib/models.js', () => ({
  getFreeModels: async () => ['mock-model/free'],
}));

function makeLLMResponse(content) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

function makeLLMStreamResponse(chunks) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const data = JSON.stringify({ choices: [{ delta: { content: chunk } }] });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return { ok: true, body: stream };
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  vi.resetAllMocks();
  mockSaveCallSummary.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
});

describe('Summariser', () => {
  it('returns summary with expected shape', async () => {
    mockFetch.mockResolvedValueOnce(makeLLMResponse('Caller: Policyholder, inbound\n\nSubject:\nTest'));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    const result = await s.summarise('test transcript');
    expect(result).toMatchObject({
      summary: expect.any(String),
      characterCount: expect.any(Number),
      emotions: expect.any(Array),
      topics: expect.any(Array),
      model: expect.any(String),
      latencyMs: expect.any(Number),
    });
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

  it('result includes id from DB save', async () => {
    mockSaveCallSummary.mockResolvedValueOnce({ id: 99, created_at: new Date().toISOString() });
    mockFetch.mockResolvedValueOnce(makeLLMResponse('Short summary'));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    const result = await s.summarise('test transcript');
    expect(result.id).toBe(99);
  });

  it('result id is null when DB save returns null', async () => {
    mockFetch.mockResolvedValueOnce(makeLLMResponse('Short summary'));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();
    const result = await s.summarise('test transcript');
    expect(result.id).toBeNull();
  });

  it('summariseStream calls onChunk for each token', async () => {
    const chunks = ['Caller', ': John', ', inbound'];
    mockFetch.mockResolvedValueOnce(makeLLMStreamResponse(chunks));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();

    const received = [];
    await s.summariseStream('test transcript', (c) => received.push(c));

    expect(received).toEqual(chunks);
  });

  it('summariseStream assembles full summary from chunks', async () => {
    const chunks = ['Caller', ': Test', ', inbound'];
    mockFetch.mockResolvedValueOnce(makeLLMStreamResponse(chunks));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();

    const result = await s.summariseStream('test transcript', () => {});

    expect(result.summary).toBe(chunks.join(''));
  });

  it('summariseStream calls onAnalysing after streaming completes', async () => {
    mockFetch.mockResolvedValueOnce(makeLLMStreamResponse(['Summary text']));
    const { Summariser } = await import('../server/lib/summariser.js');
    const s = new Summariser();

    let analysingCalled = false;
    await s.summariseStream('test', () => {}, () => { analysingCalled = true; });

    expect(analysingCalled).toBe(true);
  });
});
