import { useState, useEffect } from 'react';

export default function StatsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setStats(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={styles.dim}>Loading stats…</p>;
  if (error)   return <div style={styles.errorBox}><strong>Error:</strong> {error}</div>;
  if (!stats)  return <p style={styles.dim}>No data yet.</p>;

  const maxEmotion = Math.max(1, ...stats.emotions.map(e => e.count));
  const maxTopic   = Math.max(1, ...stats.topics.map(t => t.count));

  return (
    <div style={styles.container}>
      <div style={styles.kpiRow}>
        <Kpi label="Total calls" value={stats.totalCalls.toLocaleString()} />
        <Kpi label="Avg summary length" value={`${stats.avgCharCount?.toLocaleString()} chars`} />
        <Kpi label="Avg processing time" value={`${(stats.avgLatencyMs / 1000).toFixed(1)}s`} />
      </div>

      <div style={styles.chartsRow}>
        <BarChart
          title="Emotions"
          rows={stats.emotions}
          max={maxEmotion}
          barColor="#fef3c7"
          barBorder="#f6d860"
          labelColor="#92400e"
        />
        <BarChart
          title="Topics"
          rows={stats.topics}
          max={maxTopic}
          barColor="#e0e7ff"
          barBorder="#a5b4fc"
          labelColor="#3730a3"
        />
      </div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiValue}>{value}</span>
      <span style={styles.kpiLabel}>{label}</span>
    </div>
  );
}

function BarChart({ title, rows, max, barColor, barBorder, labelColor }) {
  if (!rows.length) {
    return (
      <div style={styles.chart}>
        <h3 style={styles.chartTitle}>{title}</h3>
        <p style={styles.dim}>No data yet.</p>
      </div>
    );
  }

  return (
    <div style={styles.chart}>
      <h3 style={styles.chartTitle}>{title}</h3>
      <div style={styles.bars}>
        {rows.map(({ name, count }) => (
          <div key={name} style={styles.barRow}>
            <span style={{ ...styles.barLabel, color: labelColor }}>{name}</span>
            <div style={styles.barTrack}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${(count / max) * 100}%`,
                  background: barColor,
                  border: `1px solid ${barBorder}`,
                }}
              />
            </div>
            <span style={styles.barCount}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  kpi: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  kpiValue: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#1a365d',
    lineHeight: 1.2,
  },
  kpiLabel: {
    fontSize: '0.78rem',
    color: '#718096',
    fontWeight: '500',
  },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    alignItems: 'start',
  },
  chart: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  chartTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#2d3748',
    margin: 0,
  },
  bars: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  barRow: {
    display: 'grid',
    gridTemplateColumns: '110px 1fr 28px',
    alignItems: 'center',
    gap: '8px',
  },
  barLabel: {
    fontSize: '0.78rem',
    fontWeight: '500',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  barTrack: {
    height: '18px',
    background: '#f7fafc',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.4s ease',
    minWidth: '4px',
  },
  barCount: {
    fontSize: '0.72rem',
    color: '#718096',
    fontWeight: '600',
    textAlign: 'right',
  },
  dim: {
    color: '#a0aec0',
    fontSize: '0.9rem',
    margin: 0,
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
