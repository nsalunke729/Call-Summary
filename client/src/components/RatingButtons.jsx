import { useState } from 'react';

export default function RatingButtons({ id, initialRating = null }) {
  const [rating, setRating] = useState(initialRating);
  const [saving, setSaving] = useState(false);

  async function handleRate(value) {
    const next = rating === value ? null : value; // toggle off if same
    setSaving(true);
    try {
      const res = await fetch(`/api/summaries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: next }),
      });
      if (!res.ok) throw new Error('Rating failed');
      setRating(next);
    } catch {
      // silent — rating is non-critical
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.row}>
      <span style={styles.label}>Was this helpful?</span>
      <button
        style={{ ...styles.btn, ...(rating === 1 ? styles.good : {}) }}
        onClick={() => handleRate(1)}
        disabled={saving}
        title="Good output"
      >
        &#x1F44D; Good
      </button>
      <button
        style={{ ...styles.btn, ...(rating === -1 ? styles.poor : {}) }}
        onClick={() => handleRate(-1)}
        disabled={saving}
        title="Poor output"
      >
        &#x1F44E; Poor
      </button>
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  label: {
    fontSize: '0.78rem',
    color: '#718096',
  },
  btn: {
    background: '#f7fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '3px 10px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    color: '#4a5568',
    fontWeight: '500',
    transition: 'background 0.15s, border-color 0.15s',
  },
  good: {
    background: '#f0fff4',
    borderColor: '#68d391',
    color: '#276749',
  },
  poor: {
    background: '#fff5f5',
    borderColor: '#fc8181',
    color: '#c53030',
  },
};
