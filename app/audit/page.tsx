import { getAuditEntries } from "@/lib/audit";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function AuditPage() {
  await requireRole(["super_admin"]);
  const { entries, error } = await getAuditEntries(100);

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">SECURITY & COMPLIANCE</div>
          <h1>Audit Log</h1>
          <p className="page-subtitle">
            Track who changed employee and licensing records, what changed, and when.
          </p>
        </div>
      </header>

      {error && (
        <section className="panel audit-setup">
          <div className="eyebrow">SETUP REQUIRED</div>
          <h2>Dashboard Audit Log table</h2>
          <p className="muted">
            Create an Airtable table named <strong>Dashboard Audit Log</strong> in the configured audit base.
          </p>
          <div className="audit-field-list">
            {[
              "Timestamp",
              "User Email",
              "User Name",
              "Role",
              "Action",
              "Entity Type",
              "Entity ID",
              "Entity Name",
              "Field",
              "Old Value",
              "New Value",
            ].map(field => <span key={field}>{field}</span>)}
          </div>
          <p className="audit-error">{error}</p>
        </section>
      )}

      <section className="panel audit-panel">
        <div className="panel-title">
          <div>
            <div className="eyebrow">RECENT ACTIVITY</div>
            <h2>Latest changes</h2>
          </div>
          <span className="muted">{entries.length} entries</span>
        </div>

        <div className="audit-table">
          <div className="audit-head">
            <span>When</span>
            <span>User</span>
            <span>Action</span>
            <span>Record</span>
            <span>Field</span>
            <span>Change</span>
          </div>

          {entries.length ? entries.map(entry => (
            <div className="audit-row" key={entry.id}>
              <span>{fmt(entry.timestamp)}</span>
              <div>
                <strong>{entry.userName || entry.userEmail}</strong>
                <small>{entry.role}</small>
              </div>
              <span className="pill">{entry.action || "Updated"}</span>
              <div>
                <strong>{entry.entityName || entry.entityId || "—"}</strong>
                <small>{entry.entityType}</small>
              </div>
              <span>{entry.field || "—"}</span>
              <div className="audit-change">
                <small>Before: {entry.oldValue || "—"}</small>
                <small>After: {entry.newValue || "—"}</small>
              </div>
            </div>
          )) : (
            <div className="empty" style={{ minHeight: 160 }}>
              No edits have been recorded yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
