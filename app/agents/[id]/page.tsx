import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardData } from "@/lib/airtable";

export const dynamic = "force-dynamic";

function formatPhone(value?: string) {
  if (!value) return "—";

  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  // US / Canada
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }

  // Philippines mobile: 09XX XXX XXXX
  if (digits.length === 11 && digits.startsWith("09")) {
    return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7)}`;
  }

  // Philippines international: +63 9XX XXX XXXX
  if (digits.length === 12 && digits.startsWith("63")) {
    return `+63 ${digits.slice(2,5)} ${digits.slice(5,8)} ${digits.slice(8)}`;
  }

  // Preserve international numbers in readable groups when country varies.
  if (hasPlus && digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7, -4)} ${digits.slice(-4)}`;
  }

  return trimmed;
}

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
          <Field label="Phone Number" value={formatPhone(agent.phoneNumber)} />
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
