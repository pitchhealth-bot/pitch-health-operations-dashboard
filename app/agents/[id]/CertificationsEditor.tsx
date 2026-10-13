"use client";

import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

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

function AttachmentCard({
  file,
  removable = false,
  onRemove,
}: {
  file: CertificationFile;
  removable?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div className={`attachment-card-wrap${removable ? " removable" : ""}`}>
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
      {removable ? (
        <button
          type="button"
          className="attachment-remove-button"
          aria-label={`Remove ${file.filename}`}
          title="Remove attachment"
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onRemove?.();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
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
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <div
      className={`certification-upload-box${file ? " has-file" : ""}${dragActive ? " drag-active" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={event => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragOver={event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragActive(true);
      }}
      onDragLeave={event => {
        event.preventDefault();
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          setDragActive(false);
        }
      }}
      onDrop={event => {
        event.preventDefault();
        setDragActive(false);
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
        <strong>
          {dragActive
            ? "Release to upload"
            : file
              ? file.name
              : `Upload ${label}`}
        </strong>
        <span>
          {dragActive
            ? "Drop the file here"
            : file
              ? "Ready to save"
              : "Drop file here or click to browse"}
        </span>
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
  const [removedAhipIds, setRemovedAhipIds] = useState<string[]>([]);
  const [removedSunfireIds, setRemovedSunfireIds] = useState<string[]>([]);

  const ahipRef = useRef<HTMLInputElement>(null);
  const sunfireRef = useRef<HTMLInputElement>(null);

  const hasChanges = useMemo(
    () => Boolean(
      ahipUpload ||
      sunfireUpload ||
      removedAhipIds.length ||
      removedSunfireIds.length
    ),
    [ahipUpload, sunfireUpload, removedAhipIds, removedSunfireIds],
  );

  function cancel() {
    setAhipUpload(null);
    setSunfireUpload(null);
    setRemovedAhipIds([]);
    setRemovedSunfireIds([]);
    setMessage("");
    setEditing(false);
  }

  async function saveKind(
    kind: "ahip2027" | "sunfire",
    file: File | null,
    removeIds: string[],
  ) {
    const form = new FormData();
    form.append("kind", kind);
    if (file) form.append("file", file);
    removeIds.forEach(id => form.append("removeAttachmentId", id));

    const response = await fetch(`/api/agents/${agentId}/certifications`, {
      method: "POST",
      body: form,
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Could not save certification.");
    }

    return json.attachments as CertificationFile[];
  }

  async function save() {
    if (!hasChanges) {
      setMessage("Choose at least one file to save.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      if (ahipUpload || removedAhipIds.length) {
        const saved = await saveKind("ahip2027", ahipUpload, removedAhipIds);
        setAhipFiles(saved);
      }

      if (sunfireUpload || removedSunfireIds.length) {
        const saved = await saveKind("sunfire", sunfireUpload, removedSunfireIds);
        setSunfireFiles(saved);
      }

      setAhipUpload(null);
      setSunfireUpload(null);
      setRemovedAhipIds([]);
      setRemovedSunfireIds([]);
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
          <>
            {ahipFiles
              .filter(file => !file.id || !removedAhipIds.includes(file.id))
              .map((file, index) => (
                <AttachmentCard
                  key={file.id || `${file.filename}-${index}`}
                  file={file}
                  removable={Boolean(file.id)}
                  onRemove={() => {
                    if (file.id) {
                      setRemovedAhipIds(current => [...current, file.id!]);
                    }
                  }}
                />
              ))}
            <UploadBox
              label="AHIP 2027"
              file={ahipUpload}
              inputRef={ahipRef}
              onChange={setAhipUpload}
            />
          </>
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
          <>
            {sunfireFiles
              .filter(file => !file.id || !removedSunfireIds.includes(file.id))
              .map((file, index) => (
                <AttachmentCard
                  key={file.id || `sunfire-${file.filename}-${index}`}
                  file={file}
                  removable={Boolean(file.id)}
                  onRemove={() => {
                    if (file.id) {
                      setRemovedSunfireIds(current => [...current, file.id!]);
                    }
                  }}
                />
              ))}
            <UploadBox
              label="SunFire Report"
              file={sunfireUpload}
              inputRef={sunfireRef}
              onChange={setSunfireUpload}
            />
          </>
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
