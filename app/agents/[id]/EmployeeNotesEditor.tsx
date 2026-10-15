"use client";

import EditIcon from "@/app/components/EditIcon";
import { useState } from "react";

export default function EmployeeNotesEditor({
  agentId,
  initialNotes,
  editable,
}: {
  agentId: string;
  initialNotes: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/agents/${agentId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Could not save notes.");
      }

      setSavedNotes(notes);
      setEditing(false);
      setMessage("Saved");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setNotes(savedNotes);
    setEditing(false);
    setMessage("");
  }

  return (
    <section className="panel employee-section employee-notes-section employee-notes-aside">
      <div className="section-heading">
        <div>
          <div className="eyebrow">INTERNAL NOTES</div>
          <h2>Notes</h2>
        </div>

        {editable ? (
          editing ? (
            <div className="profile-edit-actions">
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
                disabled={saving || notes === savedNotes}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="profile-pencil-button minimal-pencil-button"
              aria-label="Edit notes"
              title="Edit notes"
              onClick={() => setEditing(true)}
            >
              <EditIcon />
            </button>
          )
        ) : null}
      </div>

      {editing ? (
        <textarea
          className="employee-notes-textarea"
          value={notes}
          onChange={event => {
            setNotes(event.target.value);
            setMessage("");
          }}
          placeholder="Add notes about this employee..."
          rows={9}
        />
      ) : (
        <div className="employee-notes-display">
          {notes.trim() ? notes : "No notes yet."}
        </div>
      )}

      {message ? (
        <div className={message === "Saved" ? "employee-notes-status success" : "employee-notes-status error"}>
          {message}
        </div>
      ) : null}
    </section>
  );
}
