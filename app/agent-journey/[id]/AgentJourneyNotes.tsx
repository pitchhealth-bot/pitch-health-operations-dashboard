"use client";

import { useMemo, useState } from "react";

export default function AgentJourneyNotes({
  agentId,
  initialNotes,
}: {
  agentId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const dirty = useMemo(() => notes !== savedNotes, [notes, savedNotes]);

  async function save() {
    if (!dirty || saving) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/agents/${agentId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save notes.");
      }

      setSavedNotes(notes);
      setMessage("Saved to Main Company Directory.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel journey-notes-panel">
      <div className="journey-notes-heading">
        <div>
          <span className="eyebrow">MAIN COMPANY DIRECTORY</span>
          <h2>Notes</h2>
          <p>All existing notes from Airtable are shown here.</p>
        </div>

        <div className="journey-notes-actions">
          {message ? (
            <span className={message.startsWith("Saved") ? "save-state success" : "save-state error"}>
              {message}
            </span>
          ) : null}
          <button
            type="button"
            className="journey-notes-save"
            onClick={save}
            disabled={!dirty || saving}
          >
            {saving ? "Saving..." : dirty ? "Save Notes" : "Saved"}
          </button>
        </div>
      </div>

      <textarea
        className="journey-notes-textarea"
        value={notes}
        onChange={event => {
          setNotes(event.target.value);
          setMessage("");
        }}
        placeholder="Add notes about this agent..."
        rows={8}
      />
    </section>
  );
}
