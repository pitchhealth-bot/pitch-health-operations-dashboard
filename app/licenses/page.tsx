import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import { daysUntil, getLicenseRecords, residentStateFromValue, displayLicenseState, type LicenseRecord } from "@/lib/licenses";
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

function sortHref(key: string, currentSort: string, currentDir: string, q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("sort", key);
  params.set("dir", currentSort === key && currentDir === "asc" ? "desc" : "asc");
  return `/licenses?${params.toString()}`;
}

function sortArrow(key: string, currentSort: string, currentDir: string) {
  if (key !== currentSort) return "";
  return currentDir === "asc" ? "↑" : "↓";
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

export default async function LicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  await requireUser();

  const { q = "", sort = "name", dir = "asc" } = await searchParams;
  const [{ records, error }, { agents }] = await Promise.all([
    getLicenseRecords(),
    getDashboardData(),
  ]);

  const query = q.trim().toLowerCase();

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
        ...group,
        licenses: sorted,
        states,
        residentState,
        nearest: sorted[0],
        expiredCount: sorted.filter(row => row.expired).length,
      };
    })
    .filter(group => {
      if (!query) return true;
      return [
        group.name,
        group.status,
        group.role,
        group.npn,
        group.email,
        ...group.states,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const direction = dir === "desc" ? -1 : 1;
      const av =
        sort === "status" ? (a.status || "") :
        sort === "role" ? (a.role || "") :
        sort === "count" ? a.licenses.length :
        sort === "resident" ? (a.residentState || "") :
        sort === "states" ? a.states.join(",") :
        sort === "expiration" ? (a.nearest.license.expirationDate || "") :
        sort === "expired" ? a.expiredCount :
        a.name;
      const bv =
        sort === "status" ? (b.status || "") :
        sort === "role" ? (b.role || "") :
        sort === "count" ? b.licenses.length :
        sort === "resident" ? (b.residentState || "") :
        sort === "states" ? b.states.join(",") :
        sort === "expiration" ? (b.nearest.license.expirationDate || "") :
        sort === "expired" ? b.expiredCount :
        b.name;

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * direction;
      }

      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction;
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

      <section className="panel">
        <form className="agents-filters">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, role, state, NPN..."
            className="search-input"
          />
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <button type="submit" className="filter-button">Search</button>
          {q && <Link href="/licenses" className="clear-link">Clear</Link>}
        </form>
      </section>

      <section className="panel agents-list-panel">
        <div className="license-summary-head">
          <Link className="sort-header" href={sortHref("name", sort, dir, q)}>Name <span className="sort-arrow">{sortArrow("name", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("status", sort, dir, q)}>Status <span className="sort-arrow">{sortArrow("status", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("role", sort, dir, q)}>Role <span className="sort-arrow">{sortArrow("role", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("count", sort, dir, q)}>Licenses Expiring <span className="sort-arrow">{sortArrow("count", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("resident", sort, dir, q)}>Resident State <span className="sort-arrow">{sortArrow("resident", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("states", sort, dir, q)}>States <span className="sort-arrow">{sortArrow("states", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("expiration", sort, dir, q)}>Nearest Expiration <span className="sort-arrow">{sortArrow("expiration", sort, dir)}</span></Link>
          <Link className="sort-header" href={sortHref("expired", sort, dir, q)}>Expired? <span className="sort-arrow">{sortArrow("expired", sort, dir)}</span></Link>
        </div>

        {rows.length ? rows.map(group => {
          const detailParams = new URLSearchParams();
          if (group.agentId) detailParams.set("agentId", group.agentId);
          if (group.npn) detailParams.set("npn", group.npn);
          if (group.email) detailParams.set("email", group.email);
          detailParams.set("name", group.name);

          return (
            <div className="license-summary-row" key={group.key}>
              <div>
                <Link className="agent-name-link" href={`/licenses/detail?${detailParams.toString()}`}>
                  <strong>{group.name}</strong>
                </Link>
              </div>
              <div>
                <span className={group.status === "Active" ? "pill success" : "pill"}>
                  {group.status || "—"}
                </span>
              </div>
              <div>{group.role || "—"}</div>
              <div>
                <span className="license-count-pill">{group.licenses.length}</span>
              </div>
              <div><strong>{group.residentState || "—"}</strong></div>
              <div className="state-badges">
                {group.states.slice(0, 5).map(state => <span key={state}>{state}</span>)}
                {group.states.length > 5 && <span>+{group.states.length - 5}</span>}
              </div>
              <div>
                <strong>{formatDate(group.nearest.license.expirationDate)}</strong>
                <div className="muted">
                  {group.nearest.expired
                    ? `${Math.abs(group.nearest.days ?? 0)}d expired`
                    : `${group.nearest.days ?? 0}d remaining`}
                </div>
              </div>
              <div>
                <span className={group.expiredCount ? "pill critical" : "pill warning"}>
                  {group.expiredCount ? `Yes · ${group.expiredCount}` : "No"}
                </span>
              </div>
            </div>
          );
        }) : (
          <div className="empty" style={{ minHeight: 180 }}>
            No licenses expiring within 30 days.
          </div>
        )}
      </section>
    </main>
  );
}
