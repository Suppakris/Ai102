import { useState } from "react";
import UploadZone from "./components/UploadZone";
import ProgressBar from "./components/ProgressBar";
import SlidePreview from "./components/SlidePreview";
import DownloadButton from "./components/DownloadButton";
import { convertPDF } from "./services/api";
import "./App.css";

const STATUS = {
  IDLE: "idle",
  UPLOADING: "uploading",
  PROCESSING: "processing",
  DONE: "done",
  ERROR: "error",
};

export default function App() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setError("");
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setStatus(STATUS.UPLOADING);
    setStage("uploading");
    setProgress(10);
    setError("");
    setResult(null);

    try {
      // Simulate stage transitions during processing
      const stageTimer1 = setTimeout(() => { setStage("parsing");   setProgress(30); }, 1500);
      const stageTimer2 = setTimeout(() => { setStage("ai");        setProgress(55); }, 3000);
      const stageTimer3 = setTimeout(() => { setStage("building");  setProgress(85); }, 6000);

      const data = await convertPDF(selectedFile, (pct) => {
        // Upload progress (first 20%)
        setProgress(Math.min(20, Math.round(pct * 0.2)));
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      setProgress(100);
      setResult(data);
      setStatus(STATUS.DONE);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Something went wrong. Please try again.";
      setError(msg);
      setStatus(STATUS.ERROR);
    }
  };

  const handleReset = () => {
    setStatus(STATUS.IDLE);
    setSelectedFile(null);
    setResult(null);
    setError("");
    setProgress(0);
    setStage("");
  };

  const isLoading = status === STATUS.UPLOADING || status === STATUS.PROCESSING;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">SlideAI</span>
        </div>
        <p className="logo-tagline">PDF → Presentation in seconds</p>
      </header>

      <main className="main">
        {/* IDLE / FILE SELECTED */}
        {(status === STATUS.IDLE || status === STATUS.ERROR) && (
          <div className="upload-section">
            <h1 className="hero-title">
              Turn any PDF into a<br />
              <span className="accent">polished presentation</span>
            </h1>
            <p className="hero-sub">
              Powered by Groq + LLaMA 3 · Free · No sign-up
            </p>

            <UploadZone
              onFileSelect={handleFileSelect}
              disabled={isLoading}
            />

            {selectedFile && (
              <div className="file-selected">
                <span className="file-icon">📄</span>
                <span className="file-name">{selectedFile.name}</span>
                <span className="file-size">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
                <button className="clear-btn" onClick={handleReset}>✕</button>
              </div>
            )}

            {error && (
              <div className="error-box">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              className="convert-btn"
              onClick={handleConvert}
              disabled={!selectedFile || isLoading}
            >
              Generate Slides →
            </button>
          </div>
        )}

        {/* LOADING */}
        {isLoading && (
          <div className="loading-section">
            <div className="spinner" />
            <h2 className="loading-title">Building your presentation…</h2>
            <p className="loading-sub">
              AI is reading your PDF and crafting slide content
            </p>
            <ProgressBar stage={stage} progress={progress} />
          </div>
        )}

        {/* DONE */}
        {status === STATUS.DONE && result && (
          <div className="result-section">
            <div className="result-header">
              <div className="success-badge">✓ Done</div>
              <h2 className="result-title">{result.presentation_title}</h2>
              <p className="result-sub">
                {result.slide_count} slides generated from your PDF
              </p>
              <div className="result-actions">
                <DownloadButton
                  downloadUrl={result.download_url}
                  filename={`${result.presentation_title}.pptx`}
                />
                <button className="reset-btn" onClick={handleReset}>
                  Convert another PDF
                </button>
              </div>
            </div>

            <SlidePreview
              slides={result.slides_preview}
              title={result.presentation_title}
            />
          </div>
        )}
      </main>

      <footer className="footer">
        Built with FastAPI · Groq · python-pptx · React
      </footer>
    </div>
  );
}