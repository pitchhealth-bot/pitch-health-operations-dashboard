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
