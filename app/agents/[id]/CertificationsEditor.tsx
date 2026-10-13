"use client";

import { useMemo, useRef, useState } from "react";

type CertificationFile = {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
};

function fileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentCard({ file }: { file: CertificationFile }) {
  return (
    <a
      className="attachment-card"
      href={file.url}
      target="_blank"
      rel="noreferrer"
    >
      <div className="attachment-icon">
        {file.type?.includes("pdf") ? "PDF" : "FILE"}
      </div>
      <div className="attachment-copy">
        <strong>{file.filename}</strong>
        <span>
          {file.type || "Attachment"}
          {file.size ? ` · ${fileSize(file.size)}` : ""}
        </span>
      </div>
      <div className="attachment-open">↗</div>
    </a>
  );
}

function UploadBox({
  label,
  file,
  inputRef,
  onChange,
}: {
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (file: File | null) => void;
}) {
  return (
    <div
      className={`certification-upload-box${file ? " has-file" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        onChange(event.dataTransfer.files?.[0] || null);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        hidden
        onChange={event => onChange(event.target.files?.[0] || null)}
      />
      <div className="certification-upload-icon">↑</div>
      <div>
        <strong>{file ? file.name : `Upload ${label}`}</strong>
        <span>{file ? "Ready to save" : "Drop file here or click to browse"}</span>
      </div>
    </div>
  );
}

export default function CertificationsEditor({
  agentId,
  initialAhip,
  initialSunfire,
  editable,
}: {
  agentId: string;
  initialAhip: CertificationFile[];
  initialSunfire: CertificationFile[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ahipFiles, setAhipFiles] = useState(initialAhip);
  const [sunfireFiles, setSunfireFiles] = useState(initialSunfire);
  const [ahipUpload, setAhipUpload] = useState<File | null>(null);
  const [sunfireUpload, setSunfireUpload] = useState<File | null>(null);

  const ahipRef = useRef<HTMLInputElement>(null);
  const sunfireRef = useRef<HTMLInputElement>(null);

  const hasChanges = useMemo(
    () => Boolean(ahipUpload || sunfireUpload),
    [ahipUpload, sunfireUpload],
  );

  function cancel() {
    setAhipUpload(null);
    setSunfireUpload(null);
    setMessage("");
    setEditing(false);
  }

  async function upload(kind: "ahip2027" | "sunfire", file: File) {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);

    const response = await fetch(`/api/agents/${agentId}/certifications`, {
      method: "POST",
      body: form,
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Could not save certification.");
    }

    return json.file as CertificationFile;
  }

  async function save() {
    if (!hasChanges) {
      setMessage("Choose at least one file to save.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      if (ahipUpload) {
        const saved = await upload("ahip2027", ahipUpload);
        setAhipFiles([saved]);
      }

      if (sunfireUpload) {
        const saved = await upload("sunfire", sunfireUpload);
        setSunfireFiles([saved]);
      }

      setAhipUpload(null);
      setSunfireUpload(null);
      setEditing(false);
      setMessage("Certification documents updated in Airtable.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save certification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel employee-section">
      <div className="section-heading">
        <div>
          <div className="eyebrow">DOCUMENTS</div>
          <h2>Certifications</h2>
        </div>

        <div className="profile-edit-actions">
          {!editing && editable ? (
            <button
              type="button"
              className="profile-pencil-button"
              aria-label="Edit certifications"
              title="Edit certifications"
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
          ) : editing ? (
            <>
              <button
                type="button"
                className="profile-cancel-button"
                onClick={cancel}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="profile-save-button"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="attachment-group">
        <div className="attachment-label">
          <div>
            <strong>AHIP 2027</strong>
            <span>{ahipFiles.length ? `${ahipFiles.length} attachment${ahipFiles.length > 1 ? "s" : ""}` : "No attachment"}</span>
          </div>
        </div>

        {editing ? (
          <UploadBox
            label="AHIP 2027"
            file={ahipUpload}
            inputRef={ahipRef}
            onChange={setAhipUpload}
          />
        ) : ahipFiles.length ? (
          ahipFiles.map((file, index) => (
            <AttachmentCard key={file.id || `${file.filename}-${index}`} file={file} />
          ))
        ) : (
          <div className="attachment-empty">
            <span>No AHIP 2027 attachment found in Airtable.</span>
          </div>
        )}

        <div className="attachment-label certification-second-label">
          <div>
            <strong>SunFire Report</strong>
            <span>{sunfireFiles.length ? `${sunfireFiles.length} attachment${sunfireFiles.length > 1 ? "s" : ""}` : "No attachment"}</span>
          </div>
        </div>

        {editing ? (
          <UploadBox
            label="SunFire Report"
            file={sunfireUpload}
            inputRef={sunfireRef}
            onChange={setSunfireUpload}
          />
        ) : sunfireFiles.length ? (
          sunfireFiles.map((file, index) => (
            <AttachmentCard key={file.id || `sunfire-${file.filename}-${index}`} file={file} />
          ))
        ) : (
          <div className="attachment-empty">
            <span>No SunFire Report attachment found in Airtable.</span>
          </div>
        )}

        {message ? (
          <div className={`certification-edit-message${message.includes("updated") ? " success" : ""}`}>
            {message}
          </div>
        ) : null}
      </div>
    </section>
  );
}
