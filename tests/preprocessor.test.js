import { describe, it, expect } from 'vitest';
import { cleanTranscript, transcriptStats } from '../server/lib/preprocessor.js';

describe('cleanTranscript', () => {
  it('removes [inaudible] tags', () => {
    const out = cleanTranscript('Hello [inaudible] world');
    expect(out).not.toContain('[inaudible]');
    expect(out).toContain('Hello');
    expect(out).toContain('world');
  });

  it('removes [crosstalk] tags case-insensitively', () => {
    const out = cleanTranscript('yes [Crosstalk] no');
    expect(out).not.toContain('[Crosstalk]');
  });

  it('removes all STT tag variants', () => {
    const tags = ['[inaudible]', '[crosstalk]', '[pause]', '[background noise]', '[silence]', '[laughter]'];
    for (const tag of tags) {
      const out = cleanTranscript(`before ${tag} after`);
      expect(out).not.toContain(tag);
    }
  });

  it('strips encoding artifacts', () => {
    const out = cleanTranscript('she said â€œhelloâ€');
    expect(out).not.toContain('â€');
  });

  it('removes standalone filler words', () => {
    const out = cleanTranscript('um I uh think er that hmm yes');
    expect(out).not.toMatch(/\bum\b/);
    expect(out).not.toMatch(/\buh\b/);
    expect(out).not.toMatch(/\ber\b/);
    expect(out).not.toMatch(/\bhmm\b/);
  });

  it('removes extended fillers like umm, uhh', () => {
    const out = cleanTranscript('umm okay uhh right');
    expect(out).not.toContain('umm');
    expect(out).not.toContain('uhh');
  });

  it('collapses repeated spaces', () => {
    const out = cleanTranscript('hello    world');
    expect(out).not.toMatch(/  /);
  });

  it('collapses more than two blank lines', () => {
    const out = cleanTranscript('line1\n\n\n\n\nline2');
    expect(out).not.toMatch(/\n{3}/);
  });

  it('trims leading/trailing whitespace from each line', () => {
    const out = cleanTranscript('  hello  \n  world  ');
    expect(out).toBe('hello\nworld');
  });

  it('preserves meaningful content', () => {
    const transcript = 'Caller: John Smith\nClaim number: 12345\nIBAN: GB29NWBK60161331926819';
    const out = cleanTranscript(transcript);
    expect(out).toContain('John Smith');
    expect(out).toContain('12345');
    expect(out).toContain('GB29NWBK60161331926819');
  });

  it('handles already clean text without changes', () => {
    const clean = 'Agent: Hello, how can I help you today?\nCaller: I need to update my policy.';
    const out = cleanTranscript(clean);
    expect(out).toBe(clean);
  });
});

describe('transcriptStats', () => {
  it('calculates saved characters and percentage', () => {
    const original = 'um hello [inaudible] world';
    const cleaned = 'hello world';
    const stats = transcriptStats(original, cleaned);
    expect(stats.originalChars).toBe(original.length);
    expect(stats.cleanedChars).toBe(cleaned.length);
    expect(stats.savedChars).toBe(original.length - cleaned.length);
    expect(stats.savedPct).toBeGreaterThan(0);
  });

  it('returns 0 saved when no changes', () => {
    const text = 'hello world';
    const stats = transcriptStats(text, text);
    expect(stats.savedChars).toBe(0);
    expect(stats.savedPct).toBe(0);
  });
});
