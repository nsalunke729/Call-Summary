import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchResponse(content) {
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

describe('analyseCallSummary', () => {
  it('extracts emotions and topics from clean JSON response', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse('{"emotions":["frustrated"],"topics":["payment"]}')
    );
    const { analyseCallSummary } = await import('../server/lib/analyser.js');
    const result = await analyseCallSummary('Test summary text');
    expect(result.emotions).toContain('frustrated');
    expect(result.topics).toContain('payment');
  });

  it('extracts JSON embedded in prose', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse('Here is the result: {"emotions":["calm"],"topics":["claim status"]} Done.')
    );
    const { analyseCallSummary } = await import('../server/lib/analyser.js');
    const result = await analyseCallSummary('Test summary');
    expect(result.emotions).toContain('calm');
    expect(result.topics).toContain('claim status');
  });

  it('filters out values not in the allowed vocabulary', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse('{"emotions":["happy","frustrated"],"topics":["unknown-thing","repair"]}')
    );
    const { analyseCallSummary } = await import('../server/lib/analyser.js');
    const result = await analyseCallSummary('Test summary');
    expect(result.emotions).not.toContain('happy');
    expect(result.emotions).toContain('frustrated');
    expect(result.topics).not.toContain('unknown-thing');
    expect(result.topics).toContain('repair');
  });

  it('returns empty arrays when model returns no matching values', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse('{"emotions":[],"topics":[]}')
    );
    const { analyseCallSummary } = await import('../server/lib/analyser.js');
    const result = await analyseCallSummary('Test summary');
    expect(result.emotions).toEqual([]);
    expect(result.topics).toEqual([]);
  });

  it('throws when OPENROUTER_API_KEY is missing', async () => {
    delete process.env.OPENROUTER_API_KEY;
    const { analyseCallSummary } = await import('../server/lib/analyser.js');
    await expect(analyseCallSummary('Test')).rejects.toThrow('OPENROUTER_API_KEY');
  });

  it('throws when fetch response is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    const { analyseCallSummary } = await import('../server/lib/analyser.js');
    await expect(analyseCallSummary('Test')).rejects.toThrow('401');
  });
});
