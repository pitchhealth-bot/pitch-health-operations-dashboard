import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { requireRole } from "@/lib/session";
import MissingInfoEditor from "./MissingInfoEditor";

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

      <section className="panel agents-list-panel missing-info-panel">
        <div className="missing-info-scroll">
        {incomplete.length ? (
          <MissingInfoEditor
            rows={incomplete.map(agent => ({
              id: agent.id,
              name: agent.name,
              email: agent.email,
              status: agent.status,
              role: agent.role,
              licensingStatus: agent.licensingStatus,
              ssn: agent.ssn,
              dateOfBirth: agent.dateOfBirth,
              npn: agent.npn,
              discordUserId: agent.discordUserId,
              residentState: agent.residentState,
              missingFields: agent.missingFields,
            }))}
          />
        ) : (
          <div className="empty" style={{ minHeight: 160 }}>
            All active agents have the five required profile items.
          </div>
        )}
        </div>
      </section>
    </main>
  );
}
