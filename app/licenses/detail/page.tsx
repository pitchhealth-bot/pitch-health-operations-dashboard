import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { daysUntil, getLicenseRecords } from "@/lib/licenses";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

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

export default async function LicenseDetailPage({
  searchParams,
}: {
  searchParams: Promise<{
    agentId?: string;
    npn?: string;
    email?: string;
    name?: string;
  }>;
}) {
  await requireUser();

  const params = await searchParams;
  const [{ records, error }, { agents }] = await Promise.all([
    getLicenseRecords(),
    getDashboardData(),
  ]);

  const agent = params.agentId
    ? agents.find(a => a.id === params.agentId)
    : agents.find(a =>
        (params.npn && a.npn === params.npn) ||
        (params.email && normalize(a.email) === normalize(params.email)) ||
        (params.name && normalize(a.name) === normalize(params.name))
      );

  const filtered = records
    .filter(license => {
      if (params.npn && license.npn && license.npn === params.npn) return true;
      if (params.email && license.email && normalize(license.email) === normalize(params.email)) return true;
      if (params.name && license.agentName && normalize(license.agentName) === normalize(params.name)) return true;
      return false;
    })
    .map(license => {
      const days = daysUntil(license.expirationDate);
      return {
        license,
        days,
        expired: days !== null ? days < 0 : false,
      };
    })
    .filter(row => row.days !== null && row.days <= 30)
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

  const displayName = agent?.name || params.name || filtered[0]?.license.agentName || "Agent";

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">LICENSE EXPIRATIONS</div>
          <h1>{displayName}</h1>
          <p className="page-subtitle">
            Consolidated state licenses that are expired or expiring within 30 days.
          </p>
        </div>
        <Link className="back-link" href="/licenses">← License Expirations</Link>
      </header>

      {error && (
        <section className="panel">
          <strong>License Airtable connection error</strong>
          <div className="muted" style={{ marginTop: 8 }}>{error}</div>
        </section>
      )}

      <section className="license-agent-summary">
        <div>
          <span>Status</span>
          <strong>{agent?.status || "—"}</strong>
        </div>
        <div>
          <span>Role</span>
          <strong>{agent?.role || "—"}</strong>
        </div>
        <div>
          <span>NPN</span>
          <strong>{agent?.npn || params.npn || "—"}</strong>
        </div>
        <div>
          <span>Expiring licenses</span>
          <strong>{filtered.length}</strong>
        </div>
      </section>

      <section className="panel agents-list-panel">
        <div className="license-detail-head">
          <span>State</span>
          <span>License Number</span>
          <span>Expiration Date</span>
          <span>Expired?</span>
        </div>

        {filtered.length ? filtered.map(({ license, days, expired }) => (
          <div className="license-detail-row" key={license.id}>
            <strong>{license.state || "—"}</strong>
            <span>{license.licenseNumber || "—"}</span>
            <div>
              <strong>{formatDate(license.expirationDate)}</strong>
              <div className="muted">
                {expired
                  ? `${Math.abs(days ?? 0)}d expired`
                  : `${days ?? 0}d remaining`}
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
            No expiring licenses found for this agent.
          </div>
        )}
      </section>
    </main>
  );
}
