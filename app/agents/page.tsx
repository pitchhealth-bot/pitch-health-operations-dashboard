import Link from "next/link";
import { getDashboardData } from "@/lib/airtable";
import type { Agent } from "@/lib/types";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type SortKey =
  | "name"
  | "status"
  | "role"
  | "licensingStatus"
  | "currentStage"
  | "contractingDesignation"
  | "startDate";

const columns: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "role", label: "Role" },
  { key: "licensingStatus", label: "Licensing Status" },
  { key: "currentStage", label: "Current Stage" },
  { key: "contractingDesignation", label: "Contracting Designation" },
  { key: "startDate", label: "Start Date" },
];

function valueForSort(agent: Agent, key: SortKey) {
  return String(agent[key] || "").trim();
}

function sortAgents(agents: Agent[], key: SortKey, dir: "asc" | "desc") {
  return [...agents].sort((a, b) => {
    const av = valueForSort(a, key);
    const bv = valueForSort(b, key);

    if (key === "startDate") {
      const at = av ? new Date(av).getTime() : 0;
      const bt = bv ? new Date(bv).getTime() : 0;
      return dir === "asc" ? at - bt : bt - at;
    }

    const result = av.localeCompare(bv, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return dir === "asc" ? result : -result;
  });
}

function sortHref(
  key: SortKey,
  currentSort: SortKey,
  currentDir: "asc" | "desc",
  q: string,
  licensing: string,
) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (licensing) params.set("licensing", licensing);
  params.set("sort", key);
  params.set("dir", currentSort === key && currentDir === "asc" ? "desc" : "asc");
  return `/agents?${params.toString()}`;
}

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    licensing?: string;
    sort?: string;
    dir?: string;
    filter?: string;
  }>;
}) {
  await requireUser();
  const params = await searchParams;
  const q = params.q || "";
  const licensing = params.licensing || "";
  const specialFilter = params.filter || "";
  const sort = columns.some(c => c.key === params.sort)
    ? (params.sort as SortKey)
    : "name";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const { agents, source, error } = await getDashboardData();

  const query = q.trim().toLowerCase();
  const filtered = agents.filter(agent => {
    const matchesQuery =
      !query ||
      [
        agent.name,
        agent.status,
        agent.role,
        agent.licensingStatus,
        agent.currentStage,
        agent.contractingDesignation,
        agent.startDate,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));

    const matchesLicensing =
      !licensing ||
      (agent.licensingStatus || "").toLowerCase() === licensing.toLowerCase();

    const licenseDays = (() => {
      if (!agent.licenseExpiry) return null;
      const date = new Date(agent.licenseExpiry);
      if (Number.isNaN(date.getTime())) return null;
      return Math.ceil((date.getTime() - Date.now()) / 86400000);
    })();

    const matchesSpecial =
      !specialFilter ||
      (specialFilter === "stuck" && agent.daysInStage >= 7) ||
      (specialFilter === "blocked" && Boolean(agent.blocker)) ||
      (specialFilter === "missing" && agent.missingFields.length > 0) ||
      (specialFilter === "expiring" && licenseDays !== null && licenseDays <= 30);

    return matchesQuery && matchesLicensing && matchesSpecial;
  });

  const sorted = sortAgents(filtered, sort, dir);

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">PITCH HEALTH SOLUTIONS</div>
          <h1>Active Agents</h1>
          <div className="muted">{sorted.length} of {agents.length} active agents</div>
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
            placeholder="Search active agents..."
            className="search-input"
          />
          <select name="licensing" defaultValue={licensing} className="filter-select">
            <option value="">All licensing statuses</option>
            <option value="Licensed">Licensed</option>
            <option value="Non-licensed">Non-licensed</option>
          </select>
          <input type="hidden" name="sort" value={sort} />
          {specialFilter && <input type="hidden" name="filter" value={specialFilter} />}
          <input type="hidden" name="dir" value={dir} />
          <button type="submit" className="filter-button">Filter</button>
          {(q || licensing || specialFilter) && <Link href="/agents" className="clear-link">Clear</Link>}
        </form>
      </section>

      <section className="panel agents-list-panel">
        <div className="agents-table-head active-agents-seven">
          {columns.map(column => (
            <Link
              key={column.key}
              href={sortHref(column.key, sort, dir, q, licensing)}
              className="sort-header"
            >
              <span>{column.label}</span>
              {sort === column.key && (
                <span className="sort-arrow">{dir === "asc" ? "↑" : "↓"}</span>
              )}
            </Link>
          ))}
        </div>

        {sorted.length ? sorted.map(agent => (
          <div className="agents-table-row active-agents-seven" key={agent.id}>
            <div>
              <Link href={`/agents/${agent.id}`} className="agent-name-link">
                <strong>{agent.name}</strong>
              </Link>
            </div>
            <div><span className="pill success">{agent.status || "Active"}</span></div>
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
            <div>{agent.contractingDesignation || "—"}</div>
            <div>{agent.startDate || "—"}</div>
          </div>
        )) : (
          <div className="empty" style={{ minHeight: 140 }}>No active agents match these filters.</div>
        )}
      </section>
    </main>
  );
}
