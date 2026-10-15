import Link from "next/link";
import { notFound } from "next/navigation";
import { getJourneyDirectoryData } from "@/lib/airtable";
import {
  getLicensingJourneyFieldConfig,
  getLicensingStageTrackerRecords,
} from "@/lib/contracting";
import { requireRole } from "@/lib/session";
import LicensingJourneyEditor from "./LicensingJourneyEditor";

export const dynamic = "force-dynamic";

function normalize(value?: string) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatStartDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysSinceStart(value?: string) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((todayDay.getTime() - startDay.getTime()) / 86400000));
}

export default async function AgentJourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["admin", "super_admin"]);

  const { id } = await params;
  const [directory, trackerRecords, fieldConfig] = await Promise.all([
    getJourneyDirectoryData(),
    getLicensingStageTrackerRecords(),
    getLicensingJourneyFieldConfig(),
  ]);

  const agent = directory.records.find(record => record.id === id);
  if (!agent) notFound();

  const tracker =
    (agent.npn && agent.npn !== "0"
      ? trackerRecords.find(record => normalize(record.npn) === normalize(agent.npn))
      : undefined) ||
    (agent.email
      ? trackerRecords.find(record => normalize(record.email) === normalize(agent.email))
      : undefined) ||
    (agent.personalEmail
      ? trackerRecords.find(record => normalize(record.email) === normalize(agent.personalEmail))
      : undefined) ||
    trackerRecords.find(record => normalize(record.name) === normalize(agent.name));

  const initials = agent.name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const initialValues = Object.fromEntries(
    fieldConfig.map(field => [
      field.name,
      tracker?.fields[field.actualName] || "",
    ]),
  );

  const daysFromStart = daysSinceStart(agent.startDate);

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
          <span className="eyebrow">PRE-LICENSING</span>
          <h2>{agent.name}</h2>
          <p>
            Update the agent&apos;s required licensing milestones from Licensing Stages (Tracker).
          </p>
        </div>

        <div className="journey-start-summary">
          <div>
            <span>Start Date</span>
            <strong>{formatStartDate(agent.startDate)}</strong>
          </div>
          <div>
            <span>Days Since Start</span>
            <strong>{daysFromStart === null ? "—" : `${daysFromStart} days`}</strong>
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
        <LicensingJourneyEditor
          agentId={agent.id}
          agentName={agent.name}
          trackerRecordId={tracker.recordId}
          initialValues={initialValues}
          fieldConfig={fieldConfig}
        />
      )}
    </main>
  );
}
