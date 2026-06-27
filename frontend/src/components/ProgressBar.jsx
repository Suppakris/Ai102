export default function ProgressBar({ stage, progress }) {
  const stages = [
    { key: "uploading", label: "Uploading PDF" },
    { key: "parsing",   label: "Extracting text" },
    { key: "ai",        label: "AI generating slides" },
    { key: "building",  label: "Building presentation" },
  ];

  const currentIdx = stages.findIndex((s) => s.key === stage);

  return (
    <div className="progress-container">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="progress-stages">
        {stages.map((s, i) => (
          <div
            key={s.key}
            className={`stage-item ${i < currentIdx ? "done" : ""} ${i === currentIdx ? "active" : ""}`}
          >
            <div className="stage-dot" />
            <span className="stage-label">{s.label}</span>
          </div>
        ))}
      </div>

      <p className="progress-pct">{progress}%</p>
    </div>
  );
}