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
      (agent.email || "").toLowerCase().includes(query) ||
      (agent.owner || "").toLowerCase().includes(query) ||
      (agent.stage || "").toLowerCase().includes(query);

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
            placeholder="Search name, email, owner, stage..."
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
        <div className="agents-table-head">
          <span>Agent</span>
          <span>Licensing</span>
          <span>Stage</span>
          <span>Sub-stage</span>
          <span>Owner</span>
          <span>Days in stage</span>
          <span>Blocker</span>
          <span>Missing info</span>
        </div>

        {filtered.length ? filtered.map(agent => (
          <div className="agents-table-row" key={agent.id}>
            <div>
              <strong>{agent.name}</strong>
              <div className="muted">{agent.email || "No email"}</div>
            </div>
            <div>
              <span className={
                agent.licensingStatus === "Licensed"
                  ? "pill success"
                  : agent.licensingStatus === "Non-licensed"
                    ? "pill warning"
                    : "pill"
              }>
                {agent.licensingStatus || "Unknown"}
              </span>
            </div>
            <div>{agent.stage}</div>
            <div className="muted">{agent.subStage || "—"}</div>
            <div>{agent.owner || "Unassigned"}</div>
            <div>
              <span className={
                agent.daysInStage >= 14
                  ? "pill critical"
                  : agent.daysInStage >= 7
                    ? "pill warning"
                    : "pill"
              }>
                {agent.daysInStage}d
              </span>
            </div>
            <div className="muted">{agent.blocker || "—"}</div>
            <div>
              {agent.missingFields.length
                ? <span className="pill warning">{agent.missingFields.length} missing</span>
                : <span className="pill success">Complete</span>}
            </div>
          </div>
        )) : (
          <div className="empty" style={{ minHeight: 140 }}>No active agents match these filters.</div>
        )}
      </section>
    </main>
  );
}
