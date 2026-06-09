import { useState, useRef } from 'react';

export default function TranscriptInput({ onSubmit, loading }) {
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  function loadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setTranscript(e.target.result);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function handleFileChange(e) {
    loadFile(e.target.files[0]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (transcript.trim()) onSubmit(transcript);
  }

  const canSubmit = transcript.trim().length > 0 && !loading;

  return (
    <div style={styles.card}>
      <h2 style={styles.heading}>Transcript</h2>

      <div
        style={{ ...styles.dropZone, ...(dragging ? styles.dropZoneActive : {}) }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        {fileName ? (
          <span style={styles.fileName}>📄 {fileName}</span>
        ) : (
          <span style={styles.dropHint}>Drop a .txt file here or click to browse</span>
        )}
      </div>

      <textarea
        style={styles.textarea}
        placeholder="Or paste the transcript here..."
        value={transcript}
        onChange={(e) => { setTranscript(e.target.value); setFileName(null); }}
        rows={20}
        spellCheck={false}
      />

      <div style={styles.footer}>
        <span style={styles.charInfo}>{transcript.length.toLocaleString()} characters</span>
        <button
          style={{ ...styles.button, ...(canSubmit ? {} : styles.buttonDisabled) }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {loading ? 'Summarising…' : 'Summarise'}
        </button>
      </div>
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
  heading: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#2d3748',
  },
  dropZone: {
    border: '2px dashed #cbd5e0',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  dropZoneActive: {
    borderColor: '#3182ce',
    background: '#ebf8ff',
  },
  dropHint: {
    color: '#718096',
    fontSize: '0.875rem',
  },
  fileName: {
    color: '#2b6cb0',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  textarea: {
    flex: 1,
    resize: 'vertical',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    lineHeight: '1.5',
    color: '#2d3748',
    outline: 'none',
    minHeight: '300px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charInfo: {
    fontSize: '0.8rem',
    color: '#a0aec0',
  },
  button: {
    background: '#2b6cb0',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 24px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  buttonDisabled: {
    background: '#a0aec0',
    cursor: 'not-allowed',
  },
};
