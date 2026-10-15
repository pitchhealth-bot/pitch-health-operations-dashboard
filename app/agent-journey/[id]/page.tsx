import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyDirectoryData } from "@/lib/airtable";
import { getLicensingStageTrackerRecords } from "@/lib/contracting";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";

const IDENTITY_FIELDS = new Set([
  "name",
  "agent name",
  "full name",
  "first name",
  "last name",
  "email",
  "phs email",
  "work email",
  "personal email",
  "npn",
  "national producer number",
  "record id",
  "airtable record id",
]);

function normalize(value?: string) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCompleteValue(value: string) {
  const v = value.trim().toLowerCase();
  return [
    "yes",
    "completed",
    "complete",
    "done",
    "passed",
    "approved",
    "purchased",
    "licensed",
    "ready",
    "true",
  ].includes(v);
}

function fieldPriority(name: string) {
  const n = name.toLowerCase();
  if (n.includes("course")) return 10;
  if (n.includes("exam")) return 20;
  if (n.includes("resident")) return 30;
  if (n.includes("non-resident") || n.includes("nonresident")) return 40;
  if (n.includes("background") || n.includes("fingerprint")) return 50;
  if (n.includes("license")) return 60;
  return 100;
}

export default async function AgentJourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "super_admin"]);

  const { id } = await params;
  const [directory, trackerRecords] = await Promise.all([
    getJourneyDirectoryData(),
    getLicensingStageTrackerRecords(),
  ]);

  const agent = directory.records.find(record => record.id === id);
  if (!agent) notFound();

  const tracker =
    (agent.npn
      ? trackerRecords.find(record => normalize(record.npn) === normalize(agent.npn))
      : undefined) ||
    (agent.email
      ? trackerRecords.find(record => normalize(record.email) === normalize(agent.email))
      : undefined) ||
    (agent.personalEmail
      ? trackerRecords.find(record => normalize(record.email) === normalize(agent.personalEmail))
      : undefined) ||
    trackerRecords.find(record => normalize(record.name) === normalize(agent.name));

  const allTrackerFields = Array.from(
    new Set(trackerRecords.flatMap(record => Object.keys(record.fields))),
  )
    .filter(field => !IDENTITY_FIELDS.has(field.trim().toLowerCase()))
    .filter(field => !/^created|^modified|record id|airtable/i.test(field))
    .sort((a, b) => fieldPriority(a) - fieldPriority(b) || a.localeCompare(b));

  const checklist = allTrackerFields.map(field => {
    const value = tracker?.fields[field] || "";
    const complete = Boolean(value) && isCompleteValue(value);
    return {
      field,
      value,
      complete,
      missing: !value,
    };
  });

  const completedCount = checklist.filter(item => item.complete).length;
  const missingCount = checklist.filter(item => item.missing).length;
  const initials = agent.name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="journey-detail-page">
      <header className="topbar">
        <div>
          <div className="eyebrow">AGENT JOURNEY</div>
          <h1>{agent.name}</h1>
          <div className="muted">
            {agent.role || "No role"} · {agent.status || "No status"}
          </div>
        </div>
        <Link href="/#agent-journey" className="back-link">← Agent Journey</Link>
      </header>

      <section className="journey-detail-hero">
        <div className="journey-detail-avatar">{initials || "A"}</div>
        <div>
          <span className="eyebrow">PRE-LICENSING READINESS</span>
          <h2>{agent.name}</h2>
          <p>
            Review the requirements pulled from Licensing Stages (Tracker) and see what still needs attention.
          </p>
        </div>
        <div className="journey-detail-summary">
          <div>
            <strong>{completedCount}</strong>
            <span>Completed</span>
          </div>
          <div>
            <strong>{missingCount}</strong>
            <span>Missing</span>
          </div>
        </div>
      </section>

      {!tracker ? (
        <section className="panel journey-tracker-warning">
          <strong>No Licensing Stages (Tracker) record matched this agent.</strong>
          <p>
            Matching is attempted by NPN, work/personal email, then name.
          </p>
        </section>
      ) : (
        <>
          <section className="panel journey-agent-overview">
            <div className="journey-overview-item">
              <span>Licensing Status</span>
              <strong>{agent.licensingStatus || "—"}</strong>
            </div>
            <div className="journey-overview-item">
              <span>NPN</span>
              <strong>{agent.npn && agent.npn !== "0" ? agent.npn : "Not assigned"}</strong>
            </div>
            <div className="journey-overview-item">
              <span>Bootcamp Update</span>
              <strong>{agent.bootcampUpdate || "—"}</strong>
            </div>
            <div className="journey-overview-item">
              <span>Tracker Record</span>
              <strong>Connected</strong>
            </div>
          </section>

          <section className="panel journey-checklist-panel">
            <div className="panel-title">
              <div>
                <span className="eyebrow">LICENSING STAGES TRACKER</span>
                <h2>Pre-Licensing Checklist</h2>
              </div>
              <span className="panel-kicker">{checklist.length} tracked items</span>
            </div>

            <div className="journey-checklist-grid">
              {checklist.map(item => (
                <div
                  className={`journey-check-item ${item.complete ? "complete" : item.missing ? "missing" : "pending"}`}
                  key={item.field}
                >
                  <div className="journey-check-icon" aria-hidden="true">
                    {item.complete ? "✓" : item.missing ? "!" : "•"}
                  </div>
                  <div className="journey-check-copy">
                    <strong>{item.field}</strong>
                    <span>
                      {item.value || "Not completed"}
                    </span>
                  </div>
                  <div className="journey-check-status">
                    {item.complete ? "Complete" : item.missing ? "Missing" : "In progress"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
