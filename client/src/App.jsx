import { useState } from 'react';
import TranscriptInput from './components/TranscriptInput.jsx';
import SummaryOutput from './components/SummaryOutput.jsx';
import HistoryTab from './components/HistoryTab.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('summarise');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(transcript) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/summarise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>BrightNero Call Summariser</h1>
        <p style={styles.subtitle}>AI-powered CRM summaries for insurance call transcripts</p>
      </header>

      <nav style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'summarise' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('summarise')}
        >
          Summarise
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'history' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </nav>

      {activeTab === 'summarise' && (
        <main style={styles.main}>
          <div style={styles.panel}>
            <TranscriptInput onSubmit={handleSubmit} loading={loading} />
          </div>
          <div style={styles.panel}>
            <SummaryOutput result={result} error={error} loading={loading} />
          </div>
        </main>
      )}

      {activeTab === 'history' && (
        <main style={styles.historyMain}>
          <HistoryTab />
        </main>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '16px',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
  },
  header: {
    textAlign: 'center',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#1a365d',
  },
  subtitle: {
    marginTop: '6px',
    color: '#4a5568',
    fontSize: '0.95rem',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    borderBottom: '2px solid #e2e8f0',
    paddingBottom: '0',
  },
  tab: {
    background: 'none',
    border: 'none',
    padding: '8px 20px',
    fontSize: '0.9rem',
    fontWeight: '500',
    color: '#718096',
    cursor: 'pointer',
    borderRadius: '6px 6px 0 0',
    marginBottom: '-2px',
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s',
  },
  tabActive: {
    color: '#2b6cb0',
    borderBottom: '2px solid #2b6cb0',
    fontWeight: '600',
  },
  main: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    flex: 1,
  },
  historyMain: {
    flex: 1,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
  },
};
