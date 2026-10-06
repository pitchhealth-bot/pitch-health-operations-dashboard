export default function Loading() {
  return (
    <main>
      <div className="route-loading-head">
        <div className="loading-line loading-eyebrow" />
        <div className="loading-line loading-title" />
        <div className="loading-line loading-subtitle" />
      </div>

      <section className="loading-card-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="loading-card" key={index}>
            <div className="loading-line loading-label" />
            <div className="loading-line loading-number" />
            <div className="loading-line loading-small" />
          </div>
        ))}
      </section>

      <section className="panel loading-panel">
        <div className="loading-line loading-wide" />
        <div className="loading-line loading-wide" />
        <div className="loading-line loading-wide" />
        <div className="loading-line loading-wide" />
      </section>
    </main>
  );
}
