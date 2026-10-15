import Link from "next/link";
import { getWorkforceMovementData } from "@/lib/airtable";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value?: string) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function shortDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return dates;

  for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
    if (dates.length >= 92) break;
  }

  return dates;
}

function normalizeStatus(value?: string) {
  return (value || "").trim().toLowerCase();
}

function inRange(value: string | undefined, from: string, to: string) {
  const key = dateKey(value);
  if (!key) return false;
  return key >= from && key <= to;
}

function statusMatches(view: string, status?: string) {
  const normalized = normalizeStatus(status);
  if (view === "active") return normalized === "active";
  if (view === "terminated") return normalized === "terminated";
  if (view === "resigned") return normalized === "resigned";
  if (view === "disqualified") return normalized === "disqualified";
  if (view === "trainee") return normalized === "trainee";
  if (view === "moved") return normalized === "moved to pitch perfect";
  if (view === "non-active") return normalized !== "active";
  return true;
}

function pillClass(status?: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "active") return "success";
  if (normalized === "trainee") return "warning";
  if (normalized === "resigned" || normalized === "terminated" || normalized === "disqualified") return "critical";
  return "";
}

function buildHref(view: string, from: string, to: string) {
  const params = new URLSearchParams({ view, from, to });
  return `/workforce-movement?${params.toString()}`;
}

export default async function WorkforceMovementPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    days?: string;
    date?: string;
    status?: string;
    record?: string;
    view?: string;
    from?: string;
    to?: string;
  }>;
}) {
  await requireRole(["admin", "super_admin"]);

  const params = await searchParams;
  const { records, source, error } = await getWorkforceMovementData();

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const defaultFromDate = new Date(today);
  defaultFromDate.setDate(defaultFromDate.getDate() - 6);
  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

  const legacyDays = Math.max(1, Math.min(90, Number(params.days || 7)));
  const legacyFromDate = new Date(today);
  legacyFromDate.setDate(legacyFromDate.getDate() - (legacyDays - 1));
  const legacyFrom = legacyFromDate.toISOString().slice(0, 10);

  const from = params.from || (params.days ? legacyFrom : defaultFrom);
  const to = params.to || params.date || todayKey;

  let view = params.view || "";
  if (!view && params.type === "start") view = "added";
  if (!view && params.type === "termination") view = "terminated";
  if (!view && params.status) {
    const s = params.status.toLowerCase();
    view = s === "active" ? "active" : s;
  }
  if (!view) view = "all";

  // The selected period defines one cohort: everyone whose Start Date falls in range.
  // Every status below is calculated from that same group.
  const cohort = records.filter(record => inRange(record.startDate, from, to));

  const filtered = cohort.filter(record => {
    if (params.record && record.id !== params.record) return false;

    if (view === "added" || view === "all") return true;
    return statusMatches(view, record.status);
  }).sort((a, b) => {
    const av = parseDate(a.startDate)?.getTime() || 0;
    const bv = parseDate(b.startDate)?.getTime() || 0;
    return bv - av;
  });

  const summary = {
    added: cohort.length,
    active: cohort.filter(record => normalizeStatus(record.status) === "active").length,
    terminated: cohort.filter(record => normalizeStatus(record.status) === "terminated").length,
    resigned: cohort.filter(record => normalizeStatus(record.status) === "resigned").length,
    disqualified: cohort.filter(record => normalizeStatus(record.status) === "disqualified").length,
    trainee: cohort.filter(record => normalizeStatus(record.status) === "trainee").length,
    moved: cohort.filter(record => normalizeStatus(record.status) === "moved to pitch perfect").length,
    nonActive: cohort.filter(record => normalizeStatus(record.status) !== "active").length,
  };

  const dates = enumerateDates(from, to);
  const startsByDate = dates.map(date => ({
    date,
    label: shortDateLabel(date),
    count: cohort.filter(record => dateKey(record.startDate) === date).length,
  }));
  const maxDailyStarts = Math.max(...startsByDate.map(item => item.count), 1);

  const statusBreakdown = [
    { key: "active", label: "Active", count: summary.active },
    { key: "trainee", label: "Trainee", count: summary.trainee },
    { key: "terminated", label: "Terminated", count: summary.terminated },
    { key: "resigned", label: "Resigned", count: summary.resigned },
    { key: "disqualified", label: "Disqualified", count: summary.disqualified },
    { key: "moved", label: "Moved to Pitch Perfect", count: summary.moved },
  ];
  const maxStatusCount = Math.max(...statusBreakdown.map(item => item.count), 1);

  const views = [
    ["all", "All"],
    ["added", "Added"],
    ["active", "Active"],
    ["terminated", "Terminated"],
    ["resigned", "Resigned"],
    ["disqualified", "Disqualified"],
    ["trainee", "Trainee"],
    ["moved", "Moved to Pitch Perfect"],
    ["non-active", "Non-Active"],
  ] as const;

  const counts: Record<string, number> = {
    added: summary.added,
    active: summary.active,
    terminated: summary.terminated,
    resigned: summary.resigned,
    disqualified: summary.disqualified,
    trainee: summary.trainee,
    moved: summary.moved,
    "non-active": summary.nonActive,
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">WORKFORCE ANALYTICS</div>
          <h1>Workforce History</h1>
          <div className="muted">
            Choose a start-date cohort, then see how those starters are distributed by current status.
          </div>
        </div>
        <Link className="back-link" href="/">← Dashboard</Link>
      </header>

      {source === "error" ? (
        <section className="panel">
          <strong>Airtable connection error</strong>
          <div className="muted" style={{marginTop:8}}>{error}</div>
        </section>
      ) : null}

      <section className="panel workforce-history-controls">
        <div className="workforce-history-control-head">
          <div>
            <span className="eyebrow">DATE RANGE</span>
            <h2>Choose a period</h2>
          </div>
          <div className="workforce-quick-ranges">
            <Link href="/workforce-movement?days=7">Last 7 days</Link>
            <Link href="/workforce-movement?days=14">Last 14 days</Link>
            <Link href="/workforce-movement?days=30">Last 30 days</Link>
          </div>
        </div>

        <form className="workforce-date-form" method="get">
          <input type="hidden" name="view" value={view} />
          <label>
            <span>From</span>
            <input type="date" name="from" defaultValue={from} />
          </label>
          <label>
            <span>To</span>
            <input type="date" name="to" defaultValue={to} />
          </label>
          <button type="submit">Apply Range</button>
        </form>
      </section>

      <section className="workforce-status-grid">
        {views.filter(([key]) => key !== "all").map(([key, label]) => (
          <Link
            key={key}
            href={buildHref(key, from, to)}
            className={`workforce-status-card${view === key ? " active" : ""}`}
          >
            <span>{label}</span>
            <strong>{counts[key] ?? 0}</strong>
            <small>{key === "added" ? "Started in range" : key === "active" ? "Active from this cohort" : "From this cohort"}</small>
          </Link>
        ))}
      </section>

      <section className="workforce-cohort-charts">
        <div className="panel workforce-chart-card">
          <div className="workforce-list-title">
            <div>
              <span className="eyebrow">COHORT TREND</span>
              <h2>Starts by Date</h2>
            </div>
            <div className="muted">{summary.added} total starters</div>
          </div>

          <div className="cohort-start-chart">
            {startsByDate.map(item => (
              <Link
                href={`/workforce-movement?view=added&from=${item.date}&to=${item.date}`}
                className="cohort-start-column"
                key={item.date}
                title={`${item.label}: ${item.count} start${item.count === 1 ? "" : "s"}`}
              >
                <div className="cohort-start-bar-track">
                  <span
                    className="cohort-start-bar"
                    style={{height: `${item.count ? Math.max(10, (item.count / maxDailyStarts) * 100) : 2}%`}}
                  />
                  <b>{item.count}</b>
                </div>
                <small>{item.label}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel workforce-chart-card">
          <div className="workforce-list-title">
            <div>
              <span className="eyebrow">COHORT OUTCOME</span>
              <h2>Current Status</h2>
            </div>
            <div className="muted">Of {summary.added} starters</div>
          </div>

          <div className="cohort-status-chart">
            {statusBreakdown.map(item => (
              <Link
                href={buildHref(item.key, from, to)}
                className="cohort-status-row"
                key={item.key}
                title={`${item.label}: ${item.count}`}
              >
                <div className="cohort-status-label">
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="cohort-status-track">
                  <span style={{width: `${item.count ? Math.max(4, (item.count / maxStatusCount) * 100) : 0}%`}} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="panel workforce-movement-list">
        <div className="workforce-list-title">
          <div>
            <span className="eyebrow">RESULTS</span>
            <h2>{views.find(([key]) => key === view)?.[1] || "All"}</h2>
          </div>
          <div className="muted">{from} → {to} · {filtered.length} of {cohort.length} starters</div>
        </div>

        <div className="workforce-results-scroll">
          <div className="movement-detail-head">
            <span>Agent</span>
            <span>Role</span>
            <span>Status</span>
            <span>Start Date</span>
            <span>Termination Date</span>
          </div>

          {filtered.length ? filtered.map(record => (
            <div className="movement-detail-row" key={record.id}>
              <div>
                <Link href={`/agents/${record.id}`} className="movement-agent-link">
                  <strong>{record.name}</strong>
                </Link>
              </div>
              <div>{record.role || "No role"}</div>
              <div>
                <span className={`pill ${pillClass(record.status)}`}>
                  {record.status || "—"}
                </span>
              </div>
              <div>{record.startDate || "—"}</div>
              <div>{record.terminationDate || "—"}</div>
            </div>
          )) : (
            <div className="empty" style={{minHeight:180}}>
              No workforce records match this range and status.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
