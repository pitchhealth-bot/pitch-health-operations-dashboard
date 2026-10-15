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

  const filtered = records.filter(record => {
    if (params.record && record.id !== params.record) return false;

    if (params.date) {
      if (view === "terminated" || view === "resigned" || view === "disqualified" || view === "non-active") {
        return dateKey(record.terminationDate) === params.date && statusMatches(view, record.status);
      }
      if (view === "added") {
        return dateKey(record.startDate) === params.date;
      }
    }

    if (view === "added") {
      return inRange(record.startDate, from, to);
    }

    if (view === "active") {
      const started = parseDate(record.startDate);
      const termination = parseDate(record.terminationDate);
      const end = new Date(`${to}T23:59:59`);
      return normalizeStatus(record.status) === "active" &&
        (!started || started <= end) &&
        (!termination || termination > end);
    }

    if (["terminated", "resigned", "disqualified", "trainee", "moved", "non-active"].includes(view)) {
      if (!statusMatches(view, record.status)) return false;

      if (record.terminationDate) {
        return inRange(record.terminationDate, from, to);
      }

      return inRange(record.startDate, from, to);
    }

    return inRange(record.startDate, from, to) || inRange(record.terminationDate, from, to);
  }).sort((a, b) => {
    const av = Math.max(parseDate(a.startDate)?.getTime() || 0, parseDate(a.terminationDate)?.getTime() || 0);
    const bv = Math.max(parseDate(b.startDate)?.getTime() || 0, parseDate(b.terminationDate)?.getTime() || 0);
    return bv - av;
  });

  const summary = {
    added: records.filter(record => inRange(record.startDate, from, to)).length,
    active: records.filter(record => {
      const started = parseDate(record.startDate);
      const termination = parseDate(record.terminationDate);
      const end = new Date(`${to}T23:59:59`);
      return normalizeStatus(record.status) === "active" &&
        (!started || started <= end) &&
        (!termination || termination > end);
    }).length,
    terminated: records.filter(record => normalizeStatus(record.status) === "terminated" && (record.terminationDate ? inRange(record.terminationDate, from, to) : inRange(record.startDate, from, to))).length,
    resigned: records.filter(record => normalizeStatus(record.status) === "resigned" && (record.terminationDate ? inRange(record.terminationDate, from, to) : inRange(record.startDate, from, to))).length,
    disqualified: records.filter(record => normalizeStatus(record.status) === "disqualified" && (record.terminationDate ? inRange(record.terminationDate, from, to) : inRange(record.startDate, from, to))).length,
    trainee: records.filter(record => normalizeStatus(record.status) === "trainee" && inRange(record.startDate, from, to)).length,
    moved: records.filter(record => normalizeStatus(record.status) === "moved to pitch perfect" && (record.terminationDate ? inRange(record.terminationDate, from, to) : inRange(record.startDate, from, to))).length,
    nonActive: records.filter(record => normalizeStatus(record.status) !== "active" && (record.terminationDate ? inRange(record.terminationDate, from, to) : inRange(record.startDate, from, to))).length,
  };

  const views = [
    ["all", "All"],
    ["added", "Added"],
    ["active", "Remained Active"],
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
            Track starts, active workforce, and exits from Main Company Directory.
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
          </Link>
        ))}
      </section>

      <section className="panel workforce-movement-list">
        <div className="workforce-list-title">
          <div>
            <span className="eyebrow">RESULTS</span>
            <h2>{views.find(([key]) => key === view)?.[1] || "All"}</h2>
          </div>
          <div className="muted">{from} → {to} · {filtered.length} record{filtered.length === 1 ? "" : "s"}</div>
        </div>

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
      </section>
    </main>
  );
}
