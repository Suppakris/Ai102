export default function SlidePreview({ slides, title }) {
  return (
    <div className="preview-container">
      <div className="preview-header">
        <h2 className="preview-title">{title}</h2>
        <span className="slide-count">{slides.length} slides</span>
      </div>

      <div className="slides-grid">
        {slides.map((slide, i) => (
          <div key={i} className="slide-card">
            <div className="slide-number">Slide {i + 1}</div>
            <h3 className="slide-card-title">{slide.title}</h3>
            <ul className="slide-bullets">
              {slide.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}