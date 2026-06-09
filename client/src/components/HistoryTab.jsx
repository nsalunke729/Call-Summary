import { useState, useEffect } from 'react';

const TOPICS = [
  'vehicle damage', 'liability', 'payment', 'injury', 'policy update',
  'claim status', 'repair', 'third party', 'solicitor', 'property',
  'total loss', 'car hire', 'negotiation', 'policy query',
];

const EMOTIONS = [
  'frustrated', 'satisfied', 'anxious', 'confused', 'urgent',
  'calm', 'distressed', 'grateful', 'hostile', 'neutral',
];

export default function HistoryTab() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTopic, setSearchTopic] = useState('');
  const [searchEmotion, setSearchEmotion] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchRecent();
  }, []);

  async function fetchRecent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/summaries?limit=20');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load history');
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch({ topic = '', emotion = '' } = {}) {
    setSearchTopic(topic);
    setSearchEmotion(emotion);
    if (!topic && !emotion) return fetchRecent();
    setLoading(true);
    setError(null);
    try {
      const param = topic
        ? `topic=${encodeURIComponent(topic)}`
        : `emotion=${encodeURIComponent(emotion)}`;
      const res = await fetch(`/api/search?${param}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/summaries/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      setResults(prev => prev.filter(r => r.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <h2 style={styles.heading}>
          {searchTopic
            ? `Topic: "${searchTopic}"`
            : searchEmotion
            ? `Emotion: "${searchEmotion}"`
            : 'Recent Summaries'}
          {!loading && <span style={styles.count}>{results.length}</span>}
        </h2>
        <div style={styles.searchRow}>
          <select
            style={styles.select}
            value={searchTopic}
            onChange={e => handleSearch({ topic: e.target.value })}
          >
            <option value="">Filter by topic…</option>
            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            style={styles.select}
            value={searchEmotion}
            onChange={e => handleSearch({ emotion: e.target.value })}
          >
            <option value="">Filter by emotion…</option>
            {EMOTIONS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {(searchTopic || searchEmotion) && (
            <button style={styles.clearBtn} onClick={() => handleSearch({})}>
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && <p style={styles.dim}>Loading…</p>}
      {error && <div style={styles.errorBox}><strong>Error:</strong> {error}</div>}

      {!loading && !error && results.length === 0 && (
        <div style={styles.empty}>
          {searchTopic ? `No summaries found for topic "${searchTopic}".` : 'No summaries saved yet. Generate one from the Summarise tab.'}
        </div>
      )}

      <div style={styles.list}>
        {results.map(row => {
          const isExpanded = expandedId === row.id;
          const preview = row.summary.slice(0, 220);
          const truncated = row.summary.length > 220;

          return (
            <div key={row.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.date}>{formatDate(row.created_at)}</span>
                <div style={styles.cardActions}>
                  <span style={styles.charBadge}>{row.char_count} chars</span>
                  {confirmDeleteId === row.id ? (
                    <span style={styles.confirmRow}>
                      <span style={styles.confirmText}>Delete?</span>
                      <button
                        style={styles.confirmYes}
                        onClick={() => handleDelete(row.id)}
                        disabled={deleting}
                      >
                        Yes
                      </button>
                      <button
                        style={styles.confirmNo}
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      style={styles.deleteBtn}
                      onClick={() => setConfirmDeleteId(row.id)}
                      title="Delete record"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <p style={styles.summaryText}>
                {isExpanded ? row.summary : preview}
                {!isExpanded && truncated && '…'}
              </p>

              {truncated && (
                <button
                  style={styles.expandBtn}
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  {isExpanded ? 'Show less' : 'Show full summary'}
                </button>
              )}

              {(row.emotions?.length > 0 || row.topics?.length > 0) && (
                <div style={styles.tagArea}>
                  {row.emotions?.length > 0 && (
                    <div style={styles.tagRow}>
                      <span style={styles.tagLabel}>Emotions</span>
                      {row.emotions.map(e => (
                        <span
                          key={e}
                          style={{ ...styles.tag, ...styles.tagEmotion, cursor: 'pointer' }}
                          onClick={() => handleSearch({ emotion: e })}
                          title={`Search by "${e}"`}
                        >{e}</span>
                      ))}
                    </div>
                  )}
                  {row.topics?.length > 0 && (
                    <div style={styles.tagRow}>
                      <span style={styles.tagLabel}>Topics</span>
                      {row.topics.map(t => (
                        <span
                          key={t}
                          style={{ ...styles.tag, ...styles.tagTopic, cursor: 'pointer' }}
                          onClick={() => handleSearch({ topic: t })}
                          title={`Search by "${t}"`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  heading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2d3748',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  count: {
    background: '#e2e8f0',
    color: '#4a5568',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: '600',
    padding: '1px 8px',
  },
  searchRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  select: {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '0.85rem',
    color: '#2d3748',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  clearBtn: {
    background: '#edf2f7',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    color: '#4a5568',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid #fed7d7',
    borderRadius: '6px',
    padding: '2px 8px',
    fontSize: '0.72rem',
    color: '#c53030',
    cursor: 'pointer',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  confirmText: {
    fontSize: '0.75rem',
    color: '#c53030',
    fontWeight: '600',
  },
  confirmYes: {
    background: '#c53030',
    border: 'none',
    borderRadius: '5px',
    padding: '2px 8px',
    fontSize: '0.72rem',
    color: '#fff',
    cursor: 'pointer',
  },
  confirmNo: {
    background: '#edf2f7',
    border: 'none',
    borderRadius: '5px',
    padding: '2px 8px',
    fontSize: '0.72rem',
    color: '#4a5568',
    cursor: 'pointer',
  },
  date: {
    fontSize: '0.75rem',
    color: '#a0aec0',
  },
  charBadge: {
    fontSize: '0.72rem',
    background: '#f0fff4',
    color: '#276749',
    border: '1px solid #c6f6d5',
    borderRadius: '999px',
    padding: '1px 8px',
    fontWeight: '600',
  },
  summaryText: {
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    lineHeight: '1.6',
    color: '#2d3748',
    whiteSpace: 'pre-wrap',
    margin: 0,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '0.8rem',
    color: '#3182ce',
    cursor: 'pointer',
    textAlign: 'left',
  },
  tagArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingTop: '4px',
    borderTop: '1px solid #f0f4f8',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '6px',
  },
  tagLabel: {
    fontSize: '0.7rem',
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    minWidth: '56px',
  },
  tag: {
    padding: '2px 9px',
    borderRadius: '999px',
    fontSize: '0.76rem',
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
  dim: {
    color: '#a0aec0',
    fontSize: '0.9rem',
  },
  empty: {
    color: '#718096',
    fontSize: '0.9rem',
    padding: '40px 0',
    textAlign: 'center',
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
