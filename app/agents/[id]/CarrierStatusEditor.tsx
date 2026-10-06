"use client";

import { useMemo, useState } from "react";
import type { CarrierStatus } from "@/lib/contracting";

const STATUS_OPTIONS = ["None","Requested","Completed","Ineligible","RTS"];

function pillClass(status: string) {
  const value = status.toLowerCase();
  if (value === "rts") return "pill carrier-rts";
  if (value === "completed") return "pill carrier-completed";
  if (value === "requested") return "pill carrier-requested";
  if (value === "ineligible") return "pill carrier-ineligible";
  return "pill carrier-none";
}

export default function CarrierStatusEditor({
  agentId,
  initialStatuses,
  editable,
}: {
  agentId: string;
  initialStatuses: CarrierStatus[];
  editable: boolean;
}) {
  const [rows, setRows] = useState(initialStatuses);
  const [draft, setDraft] = useState(initialStatuses);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const changed = useMemo(() => {
    return draft.some((item, index) => {
      const original = rows[index];
      return (
        item.status !== original?.status ||
        (item.writingNumber || "") !== (original?.writingNumber || "")
      );
    });
  }, [draft, rows]);

  function updateRow(index: number, patch: Partial<CarrierStatus>) {
    setDraft(current =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function cancel() {
    setDraft(rows);
    setEditing(false);
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");

    const updates = draft
      .filter((item, index) => {
        const original = rows[index];
        return (
          item.status !== original?.status ||
          (item.writingNumber || "") !== (original?.writingNumber || "")
        );
      })
      .map(item => ({
        carrier: item.carrier,
        status: item.status,
        writingNumber: item.status === "RTS" ? (item.writingNumber || "") : "",
      }));

    if (!updates.length) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agentId}/carrier-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not save carrier status.");
      }

      const next = Array.isArray(json.carrierStatuses)
        ? json.carrierStatuses
        : draft;

      setRows(next);
      setDraft(next);
      setEditing(false);

      setMessage(
        json.auditWarning
          ? "Saved to Airtable. Audit log warning: " + json.auditWarning
          : "Saved to Airtable.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel employee-section carrier-section">
      <div className="section-heading">
        <div>
          <div className="eyebrow">CARRIER READINESS</div>
          <h2>Carrier Status</h2>
        </div>

        {editable && (
          <div className="carrier-edit-actions">
            {!editing ? (
              <button
                type="button"
                className="carrier-pencil-button"
                onClick={() => {
                  setDraft(rows);
                  setEditing(true);
                  setMessage("");
                }}
                aria-label="Edit carrier status"
                title="Edit Carrier Status"
              >
                ✎
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="carrier-cancel-button"
                  onClick={cancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="carrier-save-button"
                  onClick={save}
                  disabled={saving || !changed}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {message && (
        <div className={message.startsWith("Saved") ? "carrier-save-message success" : "carrier-save-message error"}>
          {message}
        </div>
      )}

      <div className="carrier-status-list">
        <div className="carrier-status-head">
          <span>Carrier</span>
          <span>Status</span>
          <span>Writing Number</span>
        </div>

        {(editing ? draft : rows).map((item, index) => (
          <div className="carrier-status-row" key={item.carrier}>
            <strong>{item.carrier}</strong>

            <div>
              {editing ? (
                <select
                  className="carrier-status-select"
                  value={item.status}
                  onChange={event => {
                    const status = event.target.value;
                    updateRow(index, {
                      status,
                      writingNumber: status === "RTS" ? item.writingNumber : "",
                    });
                  }}
                >
                  {!STATUS_OPTIONS.includes(item.status) && (
                    <option value={item.status}>{item.status}</option>
                  )}
                  {STATUS_OPTIONS.map(option => (
                    <option value={option} key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <span className={pillClass(item.status)}>
                  {item.status}
                </span>
              )}
            </div>

            <div>
              {editing ? (
                <input
                  className="carrier-writing-input"
                  value={item.writingNumber || ""}
                  disabled={item.status !== "RTS"}
                  placeholder={item.status === "RTS" ? "Enter writing number" : "None"}
                  onChange={event =>
                    updateRow(index, { writingNumber: event.target.value })
                  }
                />
              ) : (
                <span className="carrier-writing">
                  {item.status.toLowerCase() === "rts"
                    ? (item.writingNumber || "None")
                    : "None"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {!editable && (
        <div className="carrier-readonly-note">
          Carrier changes are available to Editor and Superadmin accounts.
        </div>
      )}
    </section>
  );
}
