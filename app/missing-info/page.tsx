import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const REQUIRED_FIELDS = [
  "SSN",
  "Date of Birth",
  "NPN",
  "Discord User ID",
  "Resident State",
] as const;

export default async function MissingInfoPage() {
  await requireRole(["admin", "super_admin"]);

  const { agents, source, error } = await getDashboardData();
  const activeAgents = agents.filter(
    agent => (agent.status || "").trim().toLowerCase() === "active",
  );

  const incomplete = activeAgents
    .filter(agent => agent.missingFields.length > 0)
    .sort((a, b) => {
      const countDiff = b.missingFields.length - a.missingFields.length;
      if (countDiff) return countDiff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">DATA COMPLETENESS</div>
          <h1>Missing Info</h1>
          <p className="page-subtitle">
            Track the five required profile items for active agents.
          </p>
          <div className="muted">
            {incomplete.length} of {activeAgents.length} active agents have missing information
          </div>
        </div>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      {source === "error" && (
        <section className="panel">
          <strong>Airtable connection error</strong>
          <div className="muted" style={{ marginTop: 8 }}>{error}</div>
        </section>
      )}

      <section className="panel missing-info-summary">
        <div className="panel-title">
          <div>
            <span className="eyebrow">REQUIRED FIELDS</span>
            <h2>Profile completeness</h2>
          </div>
        </div>

        <div className="missing-required-grid">
          {REQUIRED_FIELDS.map(field => {
            const count = incomplete.filter(agent => agent.missingFields.includes(field)).length;
            return (
              <div className="missing-required-card" key={field}>
                <span>{field}</span>
                <strong>{count}</strong>
                <small>missing</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel agents-list-panel">
        <div className="missing-info-table-head">
          <span>Agent</span>
          <span>Status</span>
          <span>Role</span>
          {REQUIRED_FIELDS.map(field => <span key={field}>{field}</span>)}
          <span>Missing</span>
        </div>

        {incomplete.length ? incomplete.map(agent => (
          <div className="missing-info-table-row" key={agent.id}>
            <div>
              <Link href={"/agents/" + agent.id} className="agent-name-link">
                <strong>{agent.name}</strong>
              </Link>
              <div className="muted">{agent.email || "No work email"}</div>
            </div>
            <div>
              <span className="pill success">{agent.status || "Active"}</span>
            </div>
            <div>{agent.role || "No Role"}</div>

            {REQUIRED_FIELDS.map(field => {
              const missing = agent.missingFields.includes(field);
              return (
                <div key={field}>
                  <span className={missing ? "pill critical" : "pill success"}>
                    {missing ? "Missing" : "Complete"}
                  </span>
                </div>
              );
            })}

            <div>
              <span className="pill warning">{agent.missingFields.length}</span>
            </div>
          </div>
        )) : (
          <div className="empty" style={{ minHeight: 160 }}>
            All active agents have the five required profile items.
          </div>
        )}
      </section>
    </main>
  );
}
