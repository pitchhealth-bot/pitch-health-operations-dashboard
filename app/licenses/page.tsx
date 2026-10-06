import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { daysUntil, getLicenseRecords, residentStateFromValue, displayLicenseState, type LicenseRecord } from "@/lib/licenses";
import { requireUser } from "@/lib/session";
import LicenseSummaryTable from "./LicenseSummaryTable";

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

function groupKey(license: LicenseRecord, agentId?: string) {
  return agentId || license.npn || normalize(license.email) || normalize(license.agentName) || license.id;
}

export default async function LicensesPage() {
  await requireUser();
  const [{ records, error }, { agents }] = await Promise.all([
    getLicenseRecords(),
    getDashboardData(),
  ]);


  const expiring = records
    .map(license => {
      const agent = findAgent(license, agents);
      const days = daysUntil(license.expirationDate);
      return { license, agent, days, expired: days !== null ? days < 0 : false };
    })
    .filter(row => row.days !== null && row.days <= 30);

  const grouped = new Map<string, {
    key: string;
    agentId?: string;
    name: string;
    status?: string;
    role?: string;
    npn?: string;
    email?: string;
    licenses: typeof expiring;
  }>();

  for (const row of expiring) {
    const key = groupKey(row.license, row.agent?.id);
    const current = grouped.get(key);

    if (current) {
      current.licenses.push(row);
      continue;
    }

    grouped.set(key, {
      key,
      agentId: row.agent?.id,
      name: row.agent?.name || row.license.agentName || "Unknown agent",
      status: row.agent?.status,
      role: row.agent?.role,
      npn: row.agent?.npn || row.license.npn,
      email: row.agent?.email || row.license.email,
      licenses: [row],
    });
  }

  const rows = [...grouped.values()]
    .map(group => {
      const sorted = [...group.licenses].sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
      const relatedRecords = records.filter(license => {
        if (group.npn && license.npn && license.npn === group.npn) return true;
        if (group.email && license.email && normalize(license.email) === normalize(group.email)) return true;
        return Boolean(group.name && license.agentName && normalize(license.agentName) === normalize(group.name));
      });
      const residentState =
        relatedRecords
          .map(license => residentStateFromValue(license.state))
          .find(Boolean) || "";
      const states = [...new Set(
        sorted
          .map(row => displayLicenseState(row.license.state))
          .filter(Boolean)
      )] as string[];

      return {
        key: group.key,
        agentId: group.agentId,
        name: group.name,
        status: group.status,
        role: group.role,
        npn: group.npn,
        email: group.email,
        licenseCount: sorted.length,
        residentState,
        states,
        nearestExpiration: sorted[0]?.license.expirationDate,
        nearestDays: sorted[0]?.days ?? 99999,
        expiredCount: sorted.filter(row => row.expired).length,
      };
    });

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">LICENSING</div>
          <h1>License Expirations</h1>
          <p className="page-subtitle">
            One entry per agent. Open an agent to review every license that is expired or expiring within 30 days.
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

      <LicenseSummaryTable rows={rows} />
    </main>
  );
}
