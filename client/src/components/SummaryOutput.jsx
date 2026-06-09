import { useState } from 'react';
import RatingButtons from './RatingButtons.jsx';

const MAX_CHARS = 1500;

export default function SummaryOutput({ result, error, loading }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!result?.summary) return;
    navigator.clipboard.writeText(result.summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const charCount = result?.summary?.length ?? 0;
  const isOver = charCount > MAX_CHARS;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Summary</h2>
        {result && (
          <div style={styles.badges}>
            <span style={{ ...styles.badge, ...(isOver ? styles.badgeRed : styles.badgeGreen) }}>
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
            <button style={styles.copyBtn} onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {loading && !result?.summary && (
        <div style={styles.center}>
          <div className="spinner" style={styles.spinner} />
          <p style={styles.loadingText}>Generating summary…</p>
        </div>
      )}

      {error && !loading && (
        <div style={styles.errorBox}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result?.summary && (
        <>
          <textarea
            style={styles.textarea}
            value={result.summary}
            readOnly
            rows={20}
          />

          {result.streaming && (
            <p style={styles.streamStatus}>Generating…</p>
          )}

          {result.analysing && (
            <p style={styles.streamStatus}>Analysing emotions &amp; topics…</p>
          )}

          {!result.streaming && !result.analysing && (result.emotions?.length > 0 || result.topics?.length > 0) && (
            <div style={styles.tagsSection}>
              {result.emotions?.length > 0 && (
                <div style={styles.tagRow}>
                  <span style={styles.tagLabel}>Emotions</span>
                  <div style={styles.tagList}>
                    {result.emotions.map(e => (
                      <span key={e} style={{ ...styles.tag, ...styles.tagEmotion }}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
              {result.topics?.length > 0 && (
                <div style={styles.tagRow}>
                  <span style={styles.tagLabel}>Topics</span>
                  <div style={styles.tagList}>
                    {result.topics.map(t => (
                      <span key={t} style={{ ...styles.tag, ...styles.tagTopic }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!result.streaming && !result.analysing && result.id && (
            <RatingButtons id={result.id} />
          )}

          {!result.streaming && !result.analysing && result.model && (
            <p style={styles.meta}>
              Model: <strong>{result.model}</strong> &nbsp;·&nbsp; Latency: <strong>{result.latencyMs?.toLocaleString()}ms</strong>
            </p>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div style={styles.center}>
          <p style={styles.placeholder}>Your summary will appear here</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    height: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2d3748',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  badge: {
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  badgeGreen: {
    background: '#c6f6d5',
    color: '#22543d',
  },
  badgeRed: {
    background: '#fed7d7',
    color: '#742a2a',
  },
  copyBtn: {
    background: '#edf2f7',
    border: 'none',
    borderRadius: '6px',
    padding: '4px 12px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    color: '#4a5568',
    fontWeight: '500',
  },
  textarea: {
    flex: 1,
    resize: 'vertical',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    lineHeight: '1.6',
    color: '#2d3748',
    outline: 'none',
    minHeight: '300px',
    background: '#f7fafc',
  },
  tagsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 14px',
    background: '#f7fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  tagLabel: {
    fontSize: '0.72rem',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: '60px',
    paddingTop: '3px',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  tag: {
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '0.78rem',
    fontWeight: '500',
  },
  tagEmotion: {
    background: '#fef3c7',
    color: '#92400e',
  },
  tagTopic: {
    background: '#e0e7ff',
    color: '#3730a3',
  },
  meta: {
    fontSize: '0.75rem',
    color: '#a0aec0',
    textAlign: 'right',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    minHeight: '200px',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #2b6cb0',
    borderRadius: '50%',
  },
  loadingText: {
    color: '#718096',
    fontSize: '0.9rem',
  },
  streamStatus: {
    fontSize: '0.8rem',
    color: '#3182ce',
    margin: 0,
  },
  placeholder: {
    color: '#a0aec0',
    fontSize: '0.95rem',
  },
  errorBox: {
    background: '#fff5f5',
    border: '1px solid #feb2b2',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#c53030',
    fontSize: '0.9rem',
  },
};
