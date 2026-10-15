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

export default async function WorkforceMovementPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    days?: string;
    date?: string;
    status?: string;
    record?: string;
  }>;
}) {
  await requireRole(["admin", "super_admin"]);

  const params = await searchParams;
  const { records, source, error } = await getWorkforceMovementData();

  const type = params.type === "termination" ? "termination" : params.type === "start" ? "start" : "";
  const days = Math.max(1, Math.min(90, Number(params.days || 14)));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const filtered = records.filter(record => {
    if (params.record && record.id !== params.record) return false;

    if (params.status && (record.status || "").trim().toLowerCase() !== params.status.toLowerCase()) {
      return false;
    }

    if (params.date) {
      const value = type === "termination" ? record.terminationDate : record.startDate;
      return dateKey(value) === params.date;
    }

    if (type) {
      const value = type === "termination" ? record.terminationDate : record.startDate;
      const date = parseDate(value);
      if (!date) return false;
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const age = Math.floor((todayStart.getTime() - day.getTime()) / 86400000);
      return age >= 0 && age < days;
    }

    return Boolean(record.startDate || record.terminationDate);
  }).sort((a, b) => {
    const av = Math.max(parseDate(a.startDate)?.getTime() || 0, parseDate(a.terminationDate)?.getTime() || 0);
    const bv = Math.max(parseDate(b.startDate)?.getTime() || 0, parseDate(b.terminationDate)?.getTime() || 0);
    return bv - av;
  });

  const title =
    params.record ? "Movement Record" :
    type === "start" ? "Recent Starts" :
    type === "termination" ? "Recent Terminations" :
    "Workforce Movement";

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">WORKFORCE ANALYTICS</div>
          <h1>{title}</h1>
          <div className="muted">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
            {params.date ? ` · ${params.date}` : type ? ` · last ${days} days` : ""}
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

      <section className="panel workforce-movement-list">
        <div className="movement-detail-head">
          <span>Agent</span>
          <span>Role</span>
          <span>Status</span>
          <span>Start Date</span>
          <span>Termination Date</span>
        </div>

        {filtered.length ? filtered.map(record => (
          <div className="movement-detail-row" key={record.id}>
            <div><strong>{record.name}</strong></div>
            <div>{record.role || "No role"}</div>
            <div>
              <span className={`pill ${(record.status || "").toLowerCase() === "active" ? "success" : "critical"}`}>
                {record.status || "—"}
              </span>
            </div>
            <div>{record.startDate || "—"}</div>
            <div>{record.terminationDate || "—"}</div>
          </div>
        )) : (
          <div className="empty" style={{minHeight:180}}>
            No workforce movement records match this view.
          </div>
        )}
      </section>
    </main>
  );
}
