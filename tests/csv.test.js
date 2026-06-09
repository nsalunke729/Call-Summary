import { describe, it, expect } from 'vitest';
import { buildCSV } from '../server/lib/csv.js';

const HEADERS = 'id,created_at,emotions,topics,char_count,latency_ms,summary';

describe('buildCSV', () => {
  it('generates the correct header row', () => {
    const csv = buildCSV([]);
    expect(csv.split('\r\n')[0]).toBe(HEADERS);
  });

  it('returns only headers for an empty rows array', () => {
    const csv = buildCSV([]);
    expect(csv).toBe(HEADERS);
  });

  it('produces one data row per record', () => {
    const rows = [
      { id: 1, created_at: '2024-01-01T10:00:00Z', emotions: [], topics: [], char_count: 100, latency_ms: 2000, summary: 'Test' },
      { id: 2, created_at: '2024-01-02T10:00:00Z', emotions: [], topics: [], char_count: 200, latency_ms: 3000, summary: 'Test 2' },
    ];
    const lines = buildCSV(rows).split('\r\n');
    expect(lines).toHaveLength(3); // header + 2 data rows
  });

  it('joins emotions and topics arrays with semicolons', () => {
    const rows = [{
      id: 1, created_at: '', char_count: 0, latency_ms: 0,
      emotions: ['frustrated', 'anxious'],
      topics: ['payment', 'claim status'],
      summary: 'Test',
    }];
    const csv = buildCSV(rows);
    expect(csv).toContain('frustrated; anxious');
    expect(csv).toContain('payment; claim status');
  });

  it('wraps fields containing commas in double quotes', () => {
    const rows = [{
      id: 1, created_at: '', emotions: [], topics: [], char_count: 0, latency_ms: 0,
      summary: 'Caller: John, inbound',
    }];
    const csv = buildCSV(rows);
    expect(csv).toContain('"Caller: John, inbound"');
  });

  it('escapes double quotes inside fields by doubling them', () => {
    const rows = [{
      id: 1, created_at: '', emotions: [], topics: [], char_count: 0, latency_ms: 0,
      summary: 'She said "hello"',
    }];
    const csv = buildCSV(rows);
    expect(csv).toContain('"She said ""hello"""');
  });

  it('wraps fields containing newlines in double quotes', () => {
    const rows = [{
      id: 1, created_at: '', emotions: [], topics: [], char_count: 0, latency_ms: 0,
      summary: 'Line one\nLine two',
    }];
    const csv = buildCSV(rows);
    expect(csv).toContain('"Line one\nLine two"');
  });
});
