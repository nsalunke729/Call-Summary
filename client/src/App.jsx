import { useState } from 'react';
import TranscriptInput from './components/TranscriptInput.jsx';
import SummaryOutput from './components/SummaryOutput.jsx';
import HistoryTab from './components/HistoryTab.jsx';
import StatsTab from './components/StatsTab.jsx';

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

      if (!res.ok) {
        const text = await res.text();
        let msg = 'Request failed';
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === 'chunk') {
            setResult(prev => ({
              ...(prev || {}),
              summary: (prev?.summary ?? '') + event.content,
              streaming: true,
              analysing: false,
            }));
          } else if (event.type === 'analysing') {
            setResult(prev => ({ ...(prev || {}), streaming: false, analysing: true }));
          } else if (event.type === 'done') {
            setResult({ ...event, streaming: false, analysing: false });
            setLoading(false);
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="layout-page">
      <header style={styles.header}>
        <h1 style={styles.title}>BrightNero Call Summariser</h1>
        <p style={styles.subtitle}>AI-powered CRM summaries for insurance call transcripts</p>
      </header>

      <nav className="layout-tabs">
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
        <button
          style={{ ...styles.tab, ...(activeTab === 'stats' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('stats')}
        >
          Stats
        </button>
      </nav>

      {activeTab === 'summarise' && (
        <main className="layout-main">
          <div style={styles.panel}>
            <TranscriptInput onSubmit={handleSubmit} loading={loading} />
          </div>
          <div style={styles.panel}>
            <SummaryOutput result={result} error={error} loading={loading} />
          </div>
        </main>
      )}

      {activeTab === 'history' && (
        <main className="layout-full">
          <HistoryTab />
        </main>
      )}

      {activeTab === 'stats' && (
        <main className="layout-full">
          <StatsTab />
        </main>
      )}
    </div>
  );
}

const styles = {
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
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  tabActive: {
    color: '#2b6cb0',
    borderBottom: '2px solid #2b6cb0',
    fontWeight: '600',
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
  },
};
