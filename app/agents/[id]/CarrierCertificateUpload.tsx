"use client";

import { useState } from "react";

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

export default function CarrierCertificateUpload({ agentId }: { agentId: string }) {
  const [carrier, setCarrier] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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

      setMessage(`${carrier} certificate uploaded. Status changed to Contract Submitted.`);
      setFile(null);

      const input = document.getElementById(
        `carrier-certificate-file-${agentId}`,
      ) as HTMLInputElement | null;
      if (input) input.value = "";
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
          <h2>Upload Carrier Certificate</h2>
        </div>
      </div>

      <p className="carrier-cert-help">
        Choose the carrier and upload the certificate. Saving will attach the file
        in Airtable and mark that carrier as <strong>Contract Submitted</strong>.
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
          <input
            id={`carrier-certificate-file-${agentId}`}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={event => setFile(event.target.files?.[0] || null)}
          />
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
    </section>
  );
}
