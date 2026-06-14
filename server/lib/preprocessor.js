const STT_TAG = /\[(inaudible|crosstalk|pause|background noise|laughter|silence|music|noise|unintelligible)\]/gi;
const ENCODING_ARTIFACT = /â€[^\s]|Â·|â€|Ã[a-zA-Z]/g;
const FILLER_WORD = /\b(um+|uh+|er+|hmm+|mm+|mhm|erm|uhm)\b[,.]?/gi;
const REPEATED_SPACE = /[ \t]{2,}/g;
const REPEATED_BLANK_LINE = /\n{3,}/g;

export function cleanTranscript(text) {
  return text
    .replace(STT_TAG, '')
    .replace(ENCODING_ARTIFACT, '')
    .replace(FILLER_WORD, '')
    .replace(REPEATED_SPACE, ' ')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(REPEATED_BLANK_LINE, '\n\n')
    .trim();
}

export function transcriptStats(original, cleaned) {
  return {
    originalChars: original.length,
    cleanedChars: cleaned.length,
    savedChars: original.length - cleaned.length,
    savedPct: Math.round(((original.length - cleaned.length) / original.length) * 100),
  };
}
