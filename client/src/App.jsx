import { useState } from 'react';
import TranscriptInput from './components/TranscriptInput.jsx';
import SummaryOutput from './components/SummaryOutput.jsx';

export default function App() {
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
        <p style={styles.subtitle}>Paste or upload an insurance call transcript to generate a CRM summary</p>
      </header>

      <main style={styles.main}>
        <div style={styles.panel}>
          <TranscriptInput onSubmit={handleSubmit} loading={loading} />
        </div>
        <div style={styles.panel}>
          <SummaryOutput result={result} error={error} loading={loading} />
        </div>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '24px',
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
  main: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    flex: 1,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
  },
};
