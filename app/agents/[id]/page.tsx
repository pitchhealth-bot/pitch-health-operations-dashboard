import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardData } from "@/lib/airtable";
import { getAhip2027ForAgent, getCarrierStatusesForAgent } from "@/lib/contracting";

export const dynamic = "force-dynamic";

function formatPhone(value?: string) {
  if (!value) return "—";
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith("09")) {
    return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7)}`;
  }
  if (digits.length === 12 && digits.startsWith("63")) {
    return `+63 ${digits.slice(2,5)} ${digits.slice(5,8)} ${digits.slice(8)}`;
  }
  if (hasPlus && digits.length > 10) {
    return `+${digits.slice(0,digits.length-10)} ${digits.slice(-10,-7)} ${digits.slice(-7,-4)} ${digits.slice(-4)}`;
  }
  return trimmed;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month:"short", day:"numeric", year:"numeric"
  }).format(date);
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="record-field">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0,2)
    .map(part => part[0]?.toUpperCase())
    .join("");
}

function fileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const [ahip, carrierStatuses] = await Promise.all([getAhip2027ForAgent(agent.email), getCarrierStatusesForAgent(agent.email)]);

  return (
    <main>
      <header className="record-topbar">
        <Link className="back-link" href="/agents">← Active Agents</Link>
      </header>

      <section className="employee-hero">
        <div className="employee-avatar">{initials(agent.name)}</div>
        <div className="employee-hero-copy">
          <div className="eyebrow">EMPLOYEE RECORD</div>
          <h1>{agent.name}</h1>
          <div className="employee-meta">
            <span>{agent.role || "No role listed"}</span>
            <span>•</span>
            <span>{agent.contractingDesignation || "No contracting designation"}</span>
          </div>
          <div className="employee-badges">
            <span className="pill success">{agent.status || "Active"}</span>
            <span className={agent.licensingStatus === "Licensed" ? "pill success" : "pill warning"}>
              {agent.licensingStatus || "Licensing unknown"}
            </span>
            <span className="pill">{agent.currentStage || "Stage unknown"}</span>
          </div>
        </div>
        <div className="employee-hero-stat">
          <span>NPN</span>
          <strong>{agent.npn || "—"}</strong>
        </div>
      </section>
      <div className="employee-hero-spacer" aria-hidden="true" />

      <div className="employee-layout">
        <div>
          <section className="panel employee-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">CONTACT & IDENTITY</div>
                <h2>Personal Information</h2>
              </div>
            </div>

            <div className="record-grid">
              <Field label="Name" value={agent.name} />
              <Field label="Work Email" value={agent.email} />
              <Field label="Personal Email" value={agent.personalEmail} />
              <Field label="Phone Number" value={formatPhone(agent.phoneNumber)} />
              <Field label="Date of Birth" value={formatDate(agent.dateOfBirth)} />
              <Field label="Start Date" value={formatDate(agent.startDate)} />
            </div>
          </section>

          <section className="panel employee-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">EMPLOYMENT</div>
                <h2>Role & Contracting</h2>
              </div>
            </div>

            <div className="record-grid">
              <Field label="Status" value={agent.status} />
              <Field label="Role" value={agent.role} />
              <Field label="Licensing Status" value={agent.licensingStatus} />
              <Field label="Current Stage" value={agent.currentStage} />
              <Field label="Contracting Designation" value={agent.contractingDesignation} />
              <Field label="NPN" value={agent.npn} />
            </div>
          </section>
        </div>

        <aside>
          <section className="panel employee-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">DOCUMENTS</div>
                <h2>Certifications</h2>
              </div>
            </div>

            <div className="attachment-group">
              <div className="attachment-label">
                <div>
                  <strong>AHIP 2027</strong>
                  <span>{ahip.length ? `${ahip.length} attachment${ahip.length > 1 ? "s" : ""}` : "No attachment"}</span>
                </div>
              </div>

              {ahip.length ? ahip.map((file, index) => (
                <a
                  className="attachment-card"
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  key={file.id || `${file.filename}-${index}`}
                >
                  <div className="attachment-icon">PDF</div>
                  <div className="attachment-copy">
                    <strong>{file.filename}</strong>
                    <span>{file.type || "Attachment"}{file.size ? ` · ${fileSize(file.size)}` : ""}</span>
                  </div>
                  <div className="attachment-open">↗</div>
                </a>
              )) : (
                <div className="attachment-empty">
                  <span>No AHIP 2027 attachment found in Airtable.</span>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="panel employee-section carrier-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">CARRIER READINESS</div>
            <h2>Carrier Status</h2>
          </div>
        </div>

        <div className="carrier-status-list">
          <div className="carrier-status-head">
            <span>Carrier</span>
            <span>Status</span>
            <span>Writing Number</span>
          </div>

          {carrierStatuses.map(item => (
            <div className="carrier-status-row" key={item.carrier}>
              <strong>{item.carrier}</strong>
              <div>
                <span className={
                  item.status.toLowerCase() === "rts"
                    ? "pill carrier-rts"
                    : item.status.toLowerCase() === "completed"
                      ? "pill carrier-completed"
                      : item.status.toLowerCase() === "requested"
                        ? "pill carrier-requested"
                        : item.status.toLowerCase() === "ineligible"
                          ? "pill carrier-ineligible"
                          : "pill carrier-none"
                }>
                  {item.status}
                </span>
              </div>
              <span className="carrier-writing">
                {item.status.toLowerCase() === "rts" ? (item.writingNumber || "None") : "None"}
              </span>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
