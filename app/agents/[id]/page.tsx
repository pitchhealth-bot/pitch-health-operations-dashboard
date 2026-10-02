import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardData } from "@/lib/airtable";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { agents } = await getDashboardData();
  const agent = agents.find(a => a.id === id);

  if (!agent) notFound();

  return (
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">ACTIVE AGENT</div>
          <h1>{agent.name}</h1>
          <div className="muted">{agent.role || "No role listed"}</div>
        </div>
        <Link className="back-link" href="/agents">← Active Agents</Link>
      </header>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">PROFILE</span>
            <h2>Agent Information</h2>
          </div>
        </div>

        <div className="profile-grid">
          <Field label="Name" value={agent.name} />
          <Field label="Work Email" value={agent.email} />
          <Field label="Personal Email" value={agent.personalEmail} />
          <Field label="Phone Number" value={agent.phoneNumber} />
          <Field label="Date of Birth" value={agent.dateOfBirth} />
          <Field label="Start Date" value={agent.startDate} />
          <Field label="NPN" value={agent.npn} />
          <Field label="Status" value={agent.status} />
          <Field label="Role" value={agent.role} />
          <Field label="Licensing Status" value={agent.licensingStatus} />
          <Field label="Current Stage" value={agent.currentStage} />
          <Field label="Contracting Designation" value={agent.contractingDesignation} />
        </div>
      </section>
    </main>
  );
}
