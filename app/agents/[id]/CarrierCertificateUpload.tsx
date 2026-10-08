"use client";

import { DragEvent, useRef, useState } from "react";

type Certificate = {
  id: string;
  carrier: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
  createdAt: string;
  uploadedByEmail: string;
  url: string;
};

const carriers = [
  "Aetna",
  "Humana",
  "Cigna",
  "UHC",
  "Zing",
  "Devoted",
  "UNL",
  "Wellcare",
  "Heartland",
];

function fileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CarrierCertificateUpload({
  agentId,
  initialCertificates,
}: {
  agentId: string;
  initialCertificates: Certificate[];
}) {
  const [carrier, setCarrier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [certificates, setCertificates] = useState(initialCertificates);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setMessage("");
    setError("");

    if (!carrier) {
      setError("Choose a carrier first.");
      return;
    }

    if (!file) {
      setError("Choose a certificate file.");
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append("carrier", carrier);
      formData.append("file", file);

      const response = await fetch(`/api/agents/${agentId}/carrier-certificate`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      if (data.certificate) {
        setCertificates(current => [data.certificate, ...current]);
      }

      setMessage(`${carrier} certificate saved. Airtable status changed to Contract Submitted.`);
      setFile(null);

      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel employee-section carrier-cert-upload">
      <div className="section-heading">
        <div>
          <div className="eyebrow">CARRIER DOCUMENTS</div>
          <h2>Carrier Certificates</h2>
        </div>
      </div>

      <p className="carrier-cert-help">
        Certificates are stored securely in the dashboard. Airtable only receives
        the carrier status update to <strong>Contract Submitted</strong>.
      </p>

      <div className="carrier-cert-fields">
        <label>
          <span>Carrier</span>
          <select value={carrier} onChange={event => setCarrier(event.target.value)}>
            <option value="">Select carrier</option>
            {carriers.map(item => (
              <option value={item} key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Certificate</span>

          <div
            className={`carrier-dropzone${dragging ? " is-dragging" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              if (event.currentTarget === event.target) {
                setDragging(false);
              }
            }}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              setDragging(false);

              const dropped = event.dataTransfer.files?.[0] || null;
              if (dropped) setFile(dropped);
            }}
          >
            <div className="carrier-drop-icon">⇧</div>
            <div className="carrier-drop-copy">
              <strong>{file ? file.name : "Drop certificate here"}</strong>
              <span>{file ? "Click or drop another file to replace it" : "or click to browse · PDF, PNG, JPG, JPEG"}</span>
            </div>

            <input
              ref={inputRef}
              id={`carrier-certificate-file-${agentId}`}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={event => setFile(event.target.files?.[0] || null)}
              className="carrier-drop-input"
            />
          </div>
        </label>
      </div>

      {file ? <div className="carrier-cert-file">{file.name}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      {message ? <div className="form-success">{message}</div> : null}

      <button
        className="primary-button carrier-cert-save"
        type="button"
        onClick={save}
        disabled={busy}
      >
        {busy ? "Saving..." : "Save Certificate"}
      </button>

      <div className="carrier-cert-list">
        <div className="attachment-label" style={{ marginTop: 20 }}>
          <div>
            <strong>Stored Certificates</strong>
            <span>{certificates.length ? `${certificates.length} certificate${certificates.length > 1 ? "s" : ""}` : "No certificates yet"}</span>
          </div>
        </div>

        {certificates.length ? certificates.map(cert => (
          <a
            className="attachment-card"
            href={cert.url}
            target="_blank"
            rel="noreferrer"
            key={cert.id}
          >
            <div className="attachment-icon">PDF</div>
            <div className="attachment-copy">
              <strong>{cert.carrier} · {cert.fileName}</strong>
              <span>
                {cert.contentType || "Attachment"}
                {cert.sizeBytes ? ` · ${fileSize(cert.sizeBytes)}` : ""}
              </span>
            </div>
            <div className="attachment-open">↗</div>
          </a>
        )) : (
          <div className="attachment-empty">
            <span>No carrier certificates stored in the dashboard yet.</span>
          </div>
        )}
      </div>
    </section>
  );
}
