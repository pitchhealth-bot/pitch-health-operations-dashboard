export default function ActiveAgentsLoading() {
  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
          <h1>Active Agents</h1>
          <div className="muted">Loading agent data...</div>
        </div>
      </header>

      <section className="panel agents-loading-panel">
        <div className="agents-loading-card">
          <span className="agents-loading-spinner" aria-hidden="true" />
          <span>Loading active agents...</span>
        </div>
      </section>
    </main>
  );
}
