import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { daysUntil, getLicenseRecords, type LicenseRecord } from "@/lib/licenses";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function findAgent(
  license: LicenseRecord,
  agents: Awaited<ReturnType<typeof getDashboardData>>["agents"],
) {
  if (license.npn) {
    const byNpn = agents.find(agent => agent.npn && agent.npn.trim() === license.npn?.trim());
    if (byNpn) return byNpn;
  }

  if (license.email) {
    const byEmail = agents.find(agent => normalize(agent.email) === normalize(license.email));
    if (byEmail) return byEmail;
  }

  if (license.agentName) {
    return agents.find(agent => normalize(agent.name) === normalize(license.agentName));
  }

  return undefined;
}

export default async function LicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();

  const { q = "" } = await searchParams;
  const [{ records, error }, { agents }] = await Promise.all([
    getLicenseRecords(),
    getDashboardData(),
  ]);

  const query = q.trim().toLowerCase();

  const rows = records
    .map(license => {
      const agent = findAgent(license, agents);
      const days = daysUntil(license.expirationDate);
      return {
        license,
        agent,
        days,
        expired: days !== null ? days < 0 : false,
      };
    })
    .filter(row => row.days !== null && row.days <= 30)
    .filter(row => {
      if (!query) return true;
      return [
        row.license.agentName,
        row.agent?.name,
        row.agent?.status,
        row.agent?.role,
        row.license.state,
        row.license.licenseNumber,
        row.license.expirationDate,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">LICENSING</div>
          <h1>License Expirations</h1>
          <p className="page-subtitle">
            Licenses expiring within 30 days, including already expired licenses from the configured Airtable view.
          </p>
        </div>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      {error && (
        <section className="panel">
          <strong>License Airtable connection error</strong>
          <div className="muted" style={{ marginTop: 8 }}>{error}</div>
        </section>
      )}

      <section className="panel">
        <form className="agents-filters">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, role, state, license number..."
            className="search-input"
          />
          <button type="submit" className="filter-button">Search</button>
          {q && <Link href="/licenses" className="clear-link">Clear</Link>}
        </form>
      </section>

      <section className="panel agents-list-panel">
        <div className="license-table-head">
          <span>Name</span>
          <span>Status</span>
          <span>Role</span>
          <span>State</span>
          <span>License Number</span>
          <span>Expiration Date</span>
          <span>Expired?</span>
        </div>

        {rows.length ? rows.map(({ license, agent, days, expired }) => (
          <div className="license-table-row" key={license.id}>
            <div>
              <strong>{agent?.name || license.agentName || "—"}</strong>
            </div>
            <div>
              <span className={agent?.status === "Active" ? "pill success" : "pill"}>
                {agent?.status || "—"}
              </span>
            </div>
            <div>{agent?.role || "—"}</div>
            <div>{license.state || "—"}</div>
            <div>{license.licenseNumber || "—"}</div>
            <div>
              <strong>{formatDate(license.expirationDate)}</strong>
              <div className="muted">
                {days === null ? "—" : expired ? `${Math.abs(days)}d expired` : `${days}d remaining`}
              </div>
            </div>
            <div>
              <span className={expired ? "pill critical" : "pill warning"}>
                {expired ? "Yes" : "No"}
              </span>
            </div>
          </div>
        )) : (
          <div className="empty" style={{ minHeight: 180 }}>
            No licenses expiring within 30 days.
          </div>
        )}
      </section>
    </main>
  );
}
