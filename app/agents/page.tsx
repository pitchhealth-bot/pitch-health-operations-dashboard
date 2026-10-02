import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";

export const dynamic = "force-dynamic";

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; licensing?: string }>;
}) {
  const { q = "", licensing = "" } = await searchParams;
  const { agents, source, error } = await getDashboardData();

  const query = q.trim().toLowerCase();
  const filtered = agents.filter(agent => {
    const matchesQuery =
      !query ||
      agent.name.toLowerCase().includes(query) ||
      (agent.status || "").toLowerCase().includes(query) ||
      (agent.role || "").toLowerCase().includes(query) ||
      (agent.licensingStatus || "").toLowerCase().includes(query) ||
      (agent.currentStage || "").toLowerCase().includes(query);

    const matchesLicensing =
      !licensing ||
      (agent.licensingStatus || "").toLowerCase() === licensing.toLowerCase();

    return matchesQuery && matchesLicensing;
  });

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
          <h1>Active Agents</h1>
          <div className="muted">{filtered.length} of {agents.length} active agents</div>
        </div>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      {source === "error" && (
        <section className="panel">
          <strong>Airtable connection error</strong>
          <div className="muted" style={{ marginTop: 8 }}>{error}</div>
        </section>
      )}

      <section className="panel">
        <form className="agents-filters">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, status, role, licensing, or stage..."
            className="search-input"
          />
          <select name="licensing" defaultValue={licensing} className="filter-select">
            <option value="">All licensing statuses</option>
            <option value="Licensed">Licensed</option>
            <option value="Non-licensed">Non-licensed</option>
          </select>
          <button type="submit" className="filter-button">Filter</button>
          {(q || licensing) && <Link href="/agents" className="clear-link">Clear</Link>}
        </form>
      </section>

      <section className="panel agents-list-panel">
        <div className="agents-table-head active-agents-five">
          <span>Name</span>
          <span>Status</span>
          <span>Role</span>
          <span>Licensing Status</span>
          <span>Current Stage</span>
        </div>

        {filtered.length ? filtered.map(agent => (
          <div className="agents-table-row active-agents-five" key={agent.id}>
            <div><strong>{agent.name}</strong></div>
            <div>
              <span className="pill success">{agent.status || "Active"}</span>
            </div>
            <div>{agent.role || "—"}</div>
            <div>
              <span className={
                agent.licensingStatus === "Licensed"
                  ? "pill success"
                  : agent.licensingStatus === "Non-licensed"
                    ? "pill warning"
                    : "pill"
              }>
                {agent.licensingStatus || "—"}
              </span>
            </div>
            <div>{agent.currentStage || "—"}</div>
          </div>
        )) : (
          <div className="empty" style={{ minHeight: 140 }}>No active agents match these filters.</div>
        )}
      </section>
    </main>
  );
}
