import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardData } from "@/lib/airtable";
import { getCarrierStatusesForAgent, getSunFireReportForAgent, getCarrierCertificateAttachmentsForAgent, getCertificationDocumentsForAgent } from "@/lib/contracting";
import { requireUser } from "@/lib/session";
import { canEdit } from "@/lib/access";
import CarrierStatusEditor from "./CarrierStatusEditor";
import CarrierCertificateUpload from "./CarrierCertificateUpload";
import AgentProfileEditor from "./AgentProfileEditor";
import CertificationsEditor from "./CertificationsEditor";
import { getCarrierCertificatesForAgent } from "@/lib/carrier-certificates";

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
  const current = await requireUser();
  const { id } = await params;

  if (
    current.role === "agent" &&
    current.dashboardUser?.airtableAgentRecordId !== id
  ) {
    notFound();
  }
  const { agents } = await getDashboardData();
  const agent = agents.find(a => a.id === id);

  if (!agent) notFound();

  const [
    certificationDocuments,
    carrierStatuses,
    legacySunFireReports,
    carrierCertificates,
    airtableCarrierCertificates,
  ] = await Promise.all([
    getCertificationDocumentsForAgent(agent.email, agent.name),
    getCarrierStatusesForAgent(agent.email),
    getSunFireReportForAgent(agent.email),
    getCarrierCertificatesForAgent(agent.id, agent.email, agent.name),
    getCarrierCertificateAttachmentsForAgent(agent.email, agent.name),
  ]);

  const ahip = certificationDocuments.ahip;
  const sunFireReports = certificationDocuments.sunfire.length
    ? certificationDocuments.sunfire
    : legacySunFireReports;

  const mergedCarrierCertificates = [
    ...carrierCertificates,
    ...airtableCarrierCertificates
      .filter(file => !carrierCertificates.some(existing =>
        existing.carrier === file.carrier &&
        existing.fileName === file.filename
      ))
      .map(file => ({
        id: `airtable-${file.attachmentId || file.airtableRecordId + "-" + file.carrier + "-" + file.filename}`,
        carrier: file.carrier,
        fileName: file.filename,
        contentType: file.type,
        sizeBytes: file.size,
        createdAt: "",
        uploadedByEmail: "Airtable",
        url: file.url,
      })),
  ];

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
      <div className="employee-layout">
        <div>
          {canEdit(current.role) ? (
            <AgentProfileEditor
              agentId={agent.id}
              initialValues={{
                name: agent.name || "",
                email: agent.email || "",
                personalEmail: agent.personalEmail || "",
                phoneNumber: agent.phoneNumber || "",
                dateOfBirth: agent.dateOfBirth || "",
                startDate: agent.startDate || "",
                status: agent.status || "",
                role: agent.role || "",
                licensingStatus: agent.licensingStatus || "",
                currentStage: agent.currentStage || "",
                contractingDesignation: agent.contractingDesignation || "",
                npn: agent.npn || "",
                ssn: agent.ssn || "",
                discordUserId: agent.discordUserId || "",
                residentState: agent.residentState || "",
                states: agent.states || "",
              }}
            />
          ) : (
            <>
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
                  <Field label="SSN" value={agent.ssn ? `•••-••-${agent.ssn.slice(-4)}` : ""} />
                  <Field label="Discord User ID" value={agent.discordUserId} />
                  <Field label="Resident State" value={agent.residentState} />
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
                  <Field label="States" value={agent.states} />
                  <Field label="NPN" value={agent.npn} />
                </div>
              </section>
            </>
          )}
        </div>

        <aside>
          <CertificationsEditor
            agentId={agent.id}
            initialAhip={ahip}
            initialSunfire={sunFireReports}
            editable={canEdit(current.role)}
          />
        </aside>
      </div>

      {canEdit(current.role) ? (
        <CarrierCertificateUpload agentId={agent.id} initialCertificates={mergedCarrierCertificates} />
      ) : null}

      <CarrierStatusEditor
        agentId={agent.id}
        initialStatuses={carrierStatuses}
        editable={canEdit(current.role)}
      />

    </main>
  );
}
