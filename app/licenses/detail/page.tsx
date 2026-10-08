import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import {
  daysUntil,
  getLicenseRecords,
  residentStateFromValue,
  displayLicenseState,
  isTrackedLicenseState,
} from "@/lib/licenses";
import { requireRole } from "@/lib/session";

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

type ExpiringLicenseRow = {
  license: {
    id: string;
    state?: string;
    licenseNumber?: string;
    expirationDate?: string;
  };
  days: number | null;
  expired: boolean;
};

function LicenseSection({
  title,
  eyebrow,
  rows,
  emptyMessage,
}: {
  title: string;
  eyebrow: string;
  rows: ExpiringLicenseRow[];
  emptyMessage: string;
}) {
  return (
    <section className="panel agents-list-panel license-priority-section">
      <div className="license-section-title">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
        </div>
        <span className="license-count-pill">{rows.length}</span>
      </div>

      <div className="license-detail-head">
        <span>State</span>
        <span>License Number</span>
        <span>Expiration Date</span>
        <span>Expired?</span>
      </div>

      {rows.length ? rows.map(({ license, days, expired }) => (
        <div className="license-detail-row" key={license.id}>
          <strong>{displayLicenseState(license.state) || "—"}</strong>
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
            <span className={
              expired
                ? "pill critical"
                : days !== null && days >= 0 && days <= 30
                  ? "pill warning"
                  : "pill"
            }>
              {expired
                ? "Yes"
                : days !== null && days >= 0 && days <= 30
                  ? "Almost"
                  : "No"}
            </span>
          </div>
        </div>
      )) : (
        <div className="empty" style={{ minHeight: 110 }}>
          {emptyMessage}
        </div>
      )}
    </section>
  );
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
  await requireRole(["admin", "super_admin"]);

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

  const allAgentLicenses = records.filter(license => {
    if (params.npn && license.npn && license.npn === params.npn) return true;
    if (params.email && license.email && normalize(license.email) === normalize(params.email)) return true;
    if (params.name && license.agentName && normalize(license.agentName) === normalize(params.name)) return true;
    return false;
  });

  const residentState =
    allAgentLicenses
      .map(license => residentStateFromValue(license.state))
      .find(Boolean) || "";

  const expiring = allAgentLicenses
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

  const priority = expiring.filter(row => isTrackedLicenseState(row.license.state));
  const nonPriority = expiring.filter(row => !isTrackedLicenseState(row.license.state));

  const activeLicenses = allAgentLicenses
    .map(license => {
      const days = daysUntil(license.expirationDate);
      return {
        license,
        days,
        expired: false,
      };
    })
    .filter(row => row.days !== null && row.days > 30)
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));

  const displayName = agent?.name || params.name || allAgentLicenses[0]?.agentName || "Agent";

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">LICENSE EXPIRATIONS</div>
          <h1>{displayName}</h1>
          <p className="page-subtitle">
            Review expired, expiring, and active state licenses in one place.
          </p>
        </div>
        <div className="license-detail-actions">
          {agent?.id && (
            <Link className="record-link-button" href={`/agents/${agent.id}`}>
              Go to Agent Record →
            </Link>
          )}
          <Link className="back-link" href="/licenses">← License Expirations</Link>
        </div>
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
          <span>Resident State</span>
          <strong>{residentState || "—"}</strong>
        </div>
        <div>
          <span>Expiring licenses</span>
          <strong>{expiring.length}</strong>
        </div>
        <div>
          <span>Active states</span>
          <strong>{activeLicenses.length}</strong>
        </div>
      </section>

      <div className="license-priority-grid">
        <LicenseSection
          eyebrow="PRIORITY STATES"
          title="Priority Licenses"
          rows={priority}
          emptyMessage="No priority-state licenses are expired or expiring within 30 days."
        />

        <LicenseSection
          eyebrow="NON-PRIORITY STATES"
          title="Non-Priority Licenses"
          rows={nonPriority}
          emptyMessage="No non-priority-state licenses are expired or expiring within 30 days."
        />

        <LicenseSection
          eyebrow="ACTIVE STATES"
          title="Active State Licenses"
          rows={activeLicenses}
          emptyMessage="No active state licenses were found."
        />
      </div>
    </main>
  );
}
